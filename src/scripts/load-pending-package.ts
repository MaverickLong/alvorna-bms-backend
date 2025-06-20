import {
  Config,
  IsolationLevel,
  LockMode,
  MikroORM,
  wrap,
} from "@mikro-orm/core";
import { glob } from "glob";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import pMap from "p-map";
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

  await pMap(
    folders,
    async (folderPath: string) => {
      const em = orm.em.fork();
      await em.transactional(
        async () => {
          try {
            const folderName = path.basename(folderPath);

            // Create Song entity
            let song = await em.findOne(Song, { name: folderName });

            if (!song) {
              song = em.create(Song, { name: folderName });
            }

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
                { $or: [{ md5 }, { sha256 }] },
                {
                  populate: ["song"],
                }
              );

              if (existingChart) {
                // If the chart exists in a different song, reject and rollback.
                if (existingChart.song && existingChart.song != song) {
                  await logAndReject(
                    config,
                    folderPath,
                    `Hash collision with existing song: ${existingChart.song.name}`
                  );
                  return;
                }
                // Assign changed fields
                wrap(existingChart).assign({ song, localPath: filePath });
              } else {
                em.create(Chart, {
                  md5,
                  sha256,
                  song,
                  name: path.basename(filePath),
                  localPath: filePath,
                });
              }
            }

            // If it is a processed song package, skip compression
            if (!song.packagePath) {
              // Generate package path
              const packagePath = path.join(
                config.ACCEPTED_SONGS,
                `${folderName}.7z`
              );
              wrap(song).assign({ packagePath });

              // Compress and move
              await execAsync(`7z a -t7z "${packagePath}" "${folderPath}"`);
            }
            await em.flush();
          } catch (e) {
            console.log(`Error processing path ${folderPath}: ${e}`);
            await logAndReject(
              config,
              folderPath,
              `Error processing path ${folderPath}: ${e}`
            );
            return;
          }
        },
        { isolationLevel: IsolationLevel.SERIALIZABLE }
      );
    },
    { concurrency: 1 }
  );
}

async function logAndReject(
  config: Config,
  folderPath: string,
  message: string
) {
  const logEntry = `${new Date().toISOString()} - ${folderPath}: ${message}\n`;
  await fs.appendFile(config.LOG_FILE, logEntry);
  await fs.cp(
    folderPath,
    path.join(config.REJECTED_SONGS, path.basename(folderPath)),
    {
      recursive: true,
    }
  );
}

async function main() {
  const CONFIG: Config = {
    FOLDER_PATH: "/data-bms/bms-packages/",
    ACCEPTED_SONGS: "/data-bms/accepted-songs/",
    REJECTED_SONGS: "/data-bms/rejected-songs/",
    EXTENSIONS: ["bms", "bme", "bml", "pms", "bmx"],
    LOG_FILE: "/data-bms/output.log",
  };
  await processSongs(DI.orm, CONFIG);
}

await main();

exit();
