// This script loads BMS tables from config, and updates them to the latest version locally.

// Defined Utils
import utils, { DI } from "./utils.js";

// Config
import config from "./config.js";

// Other Utils
// var axios = require('axios');
import md5 from "md5";
import fs from "fs";
import { Chart } from "../entities/Chart.js";
import { DifficultyTable } from "../entities/DifficultyTable.js";

interface ChartInTable {
  md5?: string;
  sha1?: string;
  title?: string;
}

async function cleanupCharts(difficultyTable: DifficultyTable) {
  // for all chart in difficultyTable.charts, remove the corresponding reference of
  // difficultyTable in chart.difficultyTables. if the chart.difficultyTables becomes
  // an empty set and chart.song is null, remove the chart from the database.

  // Load charts with their relationships populated
  await DI.em.populate(difficultyTable, [
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
    DI.em.remove(chart);
  }
}

async function insertChartToDatabase(
  tableInDatabase: DifficultyTable,
  tableTyped: ChartInTable[]
) {
  for (const chart of tableTyped) {
    const chartTyped = chart as ChartInTable;
    if (chartTyped.md5) {
      const chartInDatabase = await DI.charts.findOne({
        md5: chartTyped.md5,
      });
      if (chartInDatabase) {
        chartInDatabase.difficultyTables.add(tableInDatabase);
      } else {
        const newChart = new Chart();
        newChart.name = chartTyped.title;
        newChart.md5 = chartTyped.md5;
        newChart.difficultyTables.add(tableInDatabase);
        DI.em.persist(newChart);
      }
    } else if (chartTyped.sha1) {
      const chartInDatabase = await DI.charts.findOne({
        sha1: chartTyped.sha1,
      });
      if (chartInDatabase) {
        chartInDatabase.difficultyTables.add(tableInDatabase);
      } else {
        const newChart = new Chart();
        newChart.name = chartTyped.title;
        newChart.sha1 = chartTyped.sha1;
        DI.em.persist(newChart);
      }
    } else {
      // We can't do anything about it. There is no information for us to inference the song.
      // New entry is created nonetheless, but we can't do anything with it.
      const newChart = new Chart();
      newChart.name = chartTyped.title;
      newChart.difficultyTables.add(tableInDatabase);
      DI.em.persist(newChart);
    }
  }
}

async function processTableUrl(tableUrl: string): Promise<void> {
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

  const tableInDatabase = await DI.tables.findOne({
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
      cleanupCharts(tableInDatabase);

      // Insert the new entries.
      insertChartToDatabase(tableInDatabase, tableTyped);
    }
    // the table has not been updated otherwise. Skipping.
  } else {
    // The difficultyTable has not present. Create a new table.
    const tableInDatabase = new DifficultyTable();
    tableInDatabase.name = headerData.name;
    tableInDatabase.md5 = tableDataMd5;
    tableInDatabase.originalUrl = tableUrl;
    tableInDatabase.proxiedUrl =
      config.urlPrefix + "/tables/" + tableUrlMd5 + "/header.json";
    DI.em.persist(tableInDatabase);

    // Insert the entries.
    insertChartToDatabase(tableInDatabase, tableTyped);
  }

  // Finally, overwrite the files nonetheless.
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath);
  }
  fs.writeFileSync(storagePath + "header.json", JSON.stringify(headerData));
  fs.writeFileSync(storagePath + "table.json", JSON.stringify(table));
}

// TODO: Err Handling
async function main() {
  // Updates all difficulty tables
  for (const tableUrl of config.diffTables) {
    try {
      // Async process
      await processTableUrl(tableUrl);
    } catch (e) {
      console.log(`Process Failed for URL ${tableUrl}, error: ${e}`);
    }
  }
}

if (require.main === module) {
  main();
}
