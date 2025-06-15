// Utilities Module

// import config from "./config.js";

// BMS File Processing
// import bmsjs from "./local_dependencies/bmsjs/index.js";
// import chardet from "./local_dependencies/chardet/index.js";
// import { Buffer } from "buffer";
// import iconv from "./local_dependencies/iconv-lite/index.js";

// File Processing
// import FileType from "file-type";

// Cheerio for HTML / URL parsing
import {
  EntityManager,
  EntityRepository,
  MikroORM,
} from "@mikro-orm/postgresql";
import * as cheerio from "cheerio";

// Axios (Web DL)
import axios from "axios";
// import { HttpsProxyAgent } from "https-proxy-agent";

import { DifficultyTable } from "../entities/DifficultyTable.entity.js";
import { Song } from "../entities/Song.entity.js";
import mikroOrmConfig from "../mikro-orm.config.js";
import { Chart } from "../entities/Chart.entity.js";

async function fetchUrl(targetUrl: string): Promise<string> {
  const RETRY_COUNT = 3;
  for (let i = 1; i <= RETRY_COUNT; i++) {
    const res = await axios
      .get(targetUrl, {
        timeout: 10000,
        signal: AbortSignal.timeout(10000),
        responseType: "text",
        transformResponse: [(data) => data],
      })
      .catch((e) => {
        console.log(
          `Error requesting ${targetUrl}\nError: ${e}\nTries ${i}/${RETRY_COUNT}`
        );
      });
    if (res) {
      return res.data;
    }
  }
  throw Error(
    `Unable to get data from ${targetUrl} after ${RETRY_COUNT} tries`
  );
}

// // PostgreSQL
// const pg = require("pg");
// const { Client } = pg;

// Verifies the validity of a possible BMS file.
// function verifyScore(bmsArrayBuffer) {
//   // First check whether the file is plain text (otherwise invalid)
//   // if ((await FileType.fromBuffer(bmsArrayBuffer)).mime != 'text/plain') {
//   //     return [false, null];
//   // }

//   // Try interpreting the file as a plain text BMS chart.
//   var bmsUintArray = new Uint8Array(bmsArrayBuffer);
//   var bmsBuffer = Buffer.from(bmsUintArray);
//   var encoding = chardet.detect(bmsBuffer);
//   var bmsContent = iconv.iconv.decode(bmsBuffer, encoding);

//   // if (!bmsContent.includes('#TITLE') || !bmsContent.includes('#BPM')) {
//   //     return [false, null];
//   // }

//   var chart = bmsjs.Compiler.compile(bmsContent);

//   if (chart.malformedSentences > 0) {
//     sendInvalidBmsFileResponse(res);
//     return [false, null];
//   }

//   // Valid BMS file.
//   return [true, chart];
// }

export const DI = {} as {
  orm: MikroORM;
  em: EntityManager;
  charts: EntityRepository<Chart>;
  tables: EntityRepository<DifficultyTable>;
  songs: EntityRepository<Song>;
};

DI.orm = await MikroORM.init(mikroOrmConfig);
DI.em = DI.orm.em;
DI.tables = DI.em.getRepository(DifficultyTable);
DI.songs = DI.em.getRepository(Song);

await DI.orm.schema.updateSchema();

function processUrl(url: string, location: string) {
  if (location.startsWith("http")) {
    return location;
  } else {
    const parsedUrl = new URL(url);
    return (
      `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname.substring(
        0,
        parsedUrl.pathname.lastIndexOf("/") + 1
      )}` + location
    );
  }
}

// Given a BMS table, returns the header JSON.
// TODO: Error Handling.
async function getJsonHeaderUrl(url: string) {
  if (url.includes(".json")) {
    console.log("Already a JSON. Returning...");
    return url;
  }
  console.log("Requesting HTML frontend to get the meta tag.");
  const data = await fetchUrl(url);
  console.log("Got the meta tag.");
  const $ = cheerio.load(data);

  // Find the meta tag with name="bmstable"
  const metaTag = $('meta[name="bmstable"]');

  // Retrieve the value of the attribute that is not 'name'
  const attributes = metaTag[0].attribs;
  const anyKey = Object.keys(attributes).find((key) => key !== "name");
  const value = attributes[anyKey].toLowerCase();

  const jsonUrl = processUrl(url, value);

  return jsonUrl;
}

export default {
  //   initialiseDatabase,
  //   verifyScore,
  getJsonHeaderUrl,
  processUrl,
  fetchUrl,
};
