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
// const axios = require('axios')
// import { HttpsProxyAgent } from "https-proxy-agent";

import fetch from "node-fetch";
import { DifficultyTable } from "../entities/DifficultyTable.js";
import { Song } from "../entities/Song.js";
import mikroOrmConfig from "../mikro-orm.config.js";
import { Chart } from "../entities/Chart.js";

async function fetchUrl(targetUrl: string) {
  // const proxyUrl = `http://${config.proxy.host}:${config.proxy.port}`;
  // const proxyAgent = new HttpsProxyAgent(proxyUrl);

  // const response = await fetch(targetUrl, { agent: proxyAgent });
  const response = await fetch(targetUrl);
  return await response.text();
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
