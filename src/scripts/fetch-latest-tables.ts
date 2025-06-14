// This script loads BMS tables from config, and updates them to the latest version locally.

// Defined Utils
import utils, { DI } from "./utils.js";

// Config
import config from "./config.js";

// Other Utils
// var axios = require('axios');
import md5 from "md5";
import fs from "fs";
import { Chart } from "../entities/Chart.entity.js";
import { DifficultyTable } from "../entities/DifficultyTable.entity.js";
import { EntityManager, IsolationLevel } from "@mikro-orm/postgresql";
import { exit } from "process";

interface ChartInTable {
  md5?: string;
  sha1?: string;
  title?: string;
}

async function cleanupCharts(
  difficultyTable: DifficultyTable,
  em: EntityManager
) {
  // for all chart in difficultyTable.charts, remove the corresponding reference of
  // difficultyTable in chart.difficultyTables. if the chart.difficultyTables becomes
  // an empty set and chart.song is null, remove the chart from the database.

  // Load charts with their relationships populated
  await em.populate(difficultyTable, [
    "charts.difficultyTables",
    "charts.song",
  ]);

  const chartsToDelete: Chart[] = [];

  for (const chart of difficultyTable.charts) {
    // Remove the difficultyTable reference
    chart.difficultyTables.remove(difficultyTable);

    // Check deletion conditions using in-memory state
    if (chart.difficultyTables.length === 0 && !chart.song) {
      chartsToDelete.push(chart);
    }
  }

  // Process deletions
  for (const chart of chartsToDelete) {
    em.remove(chart);
  }
}

async function insertChartToDatabase(
  tableInDatabase: DifficultyTable,
  tableTyped: ChartInTable[],
  em: EntityManager
) {
  for (const chart of tableTyped) {
    const chartTyped = chart as ChartInTable;
    if (chartTyped.md5) {
      const chartInDatabase = await em.findOne(Chart, { md5: chartTyped.md5 });
      if (chartInDatabase) {
        chartInDatabase.difficultyTables.add(tableInDatabase);
      } else {
        const newChart = new Chart();
        newChart.name = chartTyped.title;
        newChart.md5 = chartTyped.md5;
        newChart.difficultyTables.add(tableInDatabase);
        em.persist(newChart);
      }
    } else if (chartTyped.sha1) {
      const chartInDatabase = await em.findOne(Chart, {
        sha1: chartTyped.sha1,
      });
      if (chartInDatabase) {
        chartInDatabase.difficultyTables.add(tableInDatabase);
      } else {
        const newChart = new Chart();
        newChart.name = chartTyped.title;
        newChart.sha1 = chartTyped.sha1;
        newChart.difficultyTables.add(tableInDatabase);
        em.persist(newChart);
      }
    } else {
      // We can't do anything about it. There is no information for us to inference the song.
      // New entry is created nonetheless, but we can't do anything with it.
      const newChart = new Chart();
      newChart.name = chartTyped.title;
      newChart.difficultyTables.add(tableInDatabase);
      em.persist(newChart);
    }
  }
}

async function processTableUrl(
  tableUrl: string,
  em: EntityManager
): Promise<void> {
  console.log("Getting JSON header URL from " + tableUrl);
  const jsonUrl = await utils.getJsonHeaderUrl(tableUrl);

  console.log("Requesting JSON header from " + jsonUrl);
  const header = await utils.fetchUrl(jsonUrl);

  // .trim() removes the malformed BOM bytes within the JSON that causes error when parsing.
  const headerData = JSON.parse(header.trim()) as {
    data_url: string;
    name: string;
  };

  headerData.data_url = utils.processUrl(jsonUrl, headerData.data_url);

  console.log("Getting table data from " + headerData.data_url);
  const tableOrg = await utils.fetchUrl(headerData.data_url);

  // Main Table Content
  const table = JSON.parse(tableOrg.trim());
  const tableTyped = table as ChartInTable[];

  // Table MD5 calculation
  const tableUrlMd5 = md5(tableUrl); // Avoids name collision
  const tableDataMd5 = md5(table); // Used for determine table update

  // Difficulty Table Storage
  const storagePath = config.bmsDiffTableStorage + "/" + tableUrlMd5 + "/";

  headerData.data_url =
    config.urlPrefix + "/tables/" + tableUrlMd5 + "/table.json";

  const tableInDatabase = await em.findOne(DifficultyTable, {
    originalUrl: tableUrl,
  });

  if (tableInDatabase) {
    // We already have the package in record.
    if (tableDataMd5 != tableInDatabase.md5) {
      // Update the MD5
      tableInDatabase.md5 = tableDataMd5;
      // The table has been updated. Reload all songs to the database.

      // For simplicity, we remove all songs existed in the table first, then append
      // the new ones afterwards.
      await cleanupCharts(tableInDatabase, em);

      // Insert the new entries.
      await insertChartToDatabase(tableInDatabase, tableTyped, em);

      console.log("Updated Difficulty Table.");
    }
    // the table has not been updated otherwise. Skipping.
    console.log("The table has not been updated. Skipping.");
  } else {
    // The difficultyTable has not present. Create a new table.
    const tableInDatabase = new DifficultyTable();
    tableInDatabase.name = headerData.name;
    tableInDatabase.md5 = tableDataMd5;
    tableInDatabase.originalUrl = tableUrl;
    tableInDatabase.proxiedUrl =
      config.urlPrefix + "/tables/" + tableUrlMd5 + "/header.json";
    em.persist(tableInDatabase);

    // Insert the entries.
    await insertChartToDatabase(tableInDatabase, tableTyped, em);

    console.log("Inserted new Difficulty Table.");
  }

  // Finally, overwrite the files nonetheless.
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath);
  }
  fs.writeFileSync(storagePath + "header.json", JSON.stringify(headerData));
  fs.writeFileSync(storagePath + "table.json", JSON.stringify(table));

  console.log("Written files to the storage.");

  // Once everything's finished, flush!
  await em.flush();
}

async function main() {
  // Updates all difficulty tables
  const em = DI.em.fork();
  for (const tableUrl of config.diffTables) {
    try {
      // Async process
      await em.transactional(
        async (em) => {
          await processTableUrl(tableUrl, em);
        },
        {
          isolationLevel: IsolationLevel.SERIALIZABLE,
        }
      );
    } catch (e) {
      console.log(`Process Failed for URL ${tableUrl}, error: ${e}`);
    }
  }
}

await main();
exit();
