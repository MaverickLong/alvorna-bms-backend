import { Config, IsolationLevel, MikroORM, wrap } from "@mikro-orm/core";
import { glob } from "glob";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { Song } from "../entities/Song.entity.js";
import { Chart } from "../entities/Chart.entity.js";
import { exit } from "process";
import { DI } from "./utils.js";

const execAsync = promisify(exec);

interface Config {
  FOLDER_PATH: string;
  EXTENSIONS: string[];
  LOG_FILE: string;
  REJECTED_SONGS: string;
  ACCEPTED_SONGS: string;
}

async function processSongs(orm: MikroORM, config: Config) {
  const folders = await glob(path.join(config.FOLDER_PATH, "*", "/"));

  await Promise.all(
    folders.map(async (folderPath: string) => {
      const em = orm.em.fork();
      await em.transactional(
        async () => {
          const folderName = path.basename(folderPath);

          // Create Song entity
          const song = em.create(Song, { name: folderName });

          // Process charts
          const chartFiles = (
            await glob(`${folderPath}/**/*.{${config.EXTENSIONS.join(",")}}`)
          ).filter((f: string | string[]) => !f.includes("_MACOSX"));

          for (const filePath of chartFiles) {
            const fileBuffer = await fs.readFile(filePath);
            const md5 = createHash("md5").update(fileBuffer).digest("hex");
            const sha256 = createHash("sha256")
              .update(fileBuffer)
              .digest("hex");

            // Check for existing charts
            const existingChart = await em.findOne(
              Chart,
              {
                $or: [{ md5 }, { sha256: sha256 }],
              },
              { populate: ["song"] }
            );

            if (existingChart) {
              if (existingChart.song) {
                await em.rollback();
                await logAndReject(
                  config,
                  folderPath,
                  `Hash collision with existing song: ${existingChart.song.name}`
                );
                return;
              }
              wrap(existingChart).assign({ song });
            } else {
              em.create(Chart, {
                md5,
                sha256: sha256,
                song,
                name: path.basename(filePath),
              });
            }
          }

          // Generate package path
          const packagePath = path.join(
            config.ACCEPTED_SONGS,
            `${folderName}.7z`
          );
          wrap(song).assign({ packagePath });

          // Compress and move
          await compressAndMove(folderPath, packagePath);
          await em.flush();
        },
        { isolationLevel: IsolationLevel.SERIALIZABLE }
      );
    })
  );
}

async function compressAndMove(source: string, destination: string) {
  await execAsync(`7z a -t7z "${destination}" "${source}"`);
}

async function logAndReject(
  config: Config,
  folderPath: string,
  message: string
) {
  const logEntry = `${new Date().toISOString()} - ${folderPath}: ${message}\n`;
  await fs.appendFile(config.LOG_FILE, logEntry);
  await fs.copyFile(
    folderPath,
    path.join(config.REJECTED_SONGS, path.basename(folderPath))
  );
}

async function main() {
  const CONFIG: Config = {
    FOLDER_PATH: "bms_folders",
    ACCEPTED_SONGS: "accepted_songs",
    REJECTED_SONGS: "rejected_songs",
    EXTENSIONS: [".bms", ".bme", ".bml", ".pms", ".bmx"],
    LOG_FILE: "output.log",
  };
  await processSongs(DI.orm, CONFIG);
}

await main();

exit();
