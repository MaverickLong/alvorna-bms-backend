"use strict";

import { Router } from "express";
import { DI } from "../index.js";
import { Chart } from "../entities/Chart.entity.js";
import { readFileSync } from "fs";

const router = Router();

router.get("/tables", async (req, res) => {
  const tables = await DI.tables.findAll();
  const tablesFormatted = [] as unknown[];
  tables.forEach((table) => {
    tablesFormatted.push({
      diff_table_name: table.name,
      diff_table_url: table.originalUrl,
      // The original website uses a path without the URL. This is set to be compatible with it.
      diff_table_local_url:
        "/" + table.proxiedUrl.split("/").slice(3).join("/"),
      // This is the preferred one
      diff_table_full_local_url: table.proxiedUrl,
      diff_table_md5: table.md5,
    });
  });
  res.json({
    result: "success",
    msg: {},
    tables: tablesFormatted,
  });
});

router.get("/hash", async (req, res) => {
  if (req.query.md5 || req.query.sha256) {
    const md5 = req.query.md5 ? (req.query.md5 as string) : "";
    const sha256 = req.query.sha256 ? (req.query.sha256 as string) : "";
    const chart = await DI.em.findOne(
      Chart,
      {
        $or: [{ md5 }, { sha256 }],
      },
      { populate: ["song"] }
    );
    if (!chart) {
      res.status(404).json({
        result: "fail",
        msg: "No chart found in database",
        data: {},
      });
      return;
    }
    const res_json = {
      chart_name: chart.name,
      md5: chart.md5,
      sha256: chart.sha256,
      song_name: chart.song ? chart.song.name : null,
      song_url: chart.song
        ? `https://bms.alvorna.com/bms/zipped/${chart.song.name}.7z`
        : null,
    };
    res.json({
      result: "success",
      msg: "",
      data: res_json,
    });
    return;
  } else {
    res.status(404).json({
      result: "fail",
      msg: "No hash given",
      data: {},
    });
    return;
  }
});

/**
 * This is purely for the use of the Ribbit chart preview.
 * Therefore, only MD5 is supported.
 */
router.get("/preview", async (req, res) => {
  if (req.query.md5) {
    const md5 = req.query.md5 ? (req.query.md5 as string) : "";
    const chart = await DI.em.findOne(Chart, { md5 }, { populate: ["song"] });
    if (!chart || !chart.localPath) {
      res.status(404).send();
      return;
    }
    try {
      res.send(readFileSync(chart.localPath));
    } catch (e) {
      res.status(400).send();
      console.log(e);
      return;
    }
    return;
  } else {
    res.status(404).send();
    return;
  }
});

router.get("/search", async (req, res) => {
  const PAGE_SIZE = 20;
  const page = req.query.page ? parseInt(req.query.page as string) : 1;

  const offset = (page - 1) * PAGE_SIZE;
  const name = req.query.name ? (req.query.name as string).trim() : undefined;
  const difficultyTable = req.query.table
    ? (req.query.table as string).trim()
    : undefined;

  const result = await DI.em.find(
    Chart,
    {
      $or: [
        {
          name: name
            ? {
                $ilike: `%${name}%`,
              }
            : {},
        },
        {
          song: {
            name: req.query.name
              ? {
                  $ilike: `%${name}%`,
                }
              : {},
          },
        },
        {
          md5: name,
        },
        {
          sha256: name,
        },
      ],
      difficultyTables: difficultyTable
        ? {
            $some: {
              originalUrl: difficultyTable,
            },
          }
        : {},
    },
    {
      limit: PAGE_SIZE,
      offset: offset,
      populate: ["song.name", "difficultyTables"],
      fields: ["name", "md5", "difficultyTables"],
    }
  );

  // It's ugly, I know. God tf knows why I made the API like this!
  const formattedResult = [] as unknown[];

  result.forEach((entry) =>
    formattedResult.push({
      chart_name: entry.name,
      // Extension override. Too dumb!
      song_name: entry.song ? entry.song.name : "",
      song_url: entry.song
        ? `https://bms.alvorna.com/bms/zipped/${entry.song.name}.7z`
        : null,
      song_preview_url: entry.song
        ? `https://bms.alvorna.com/bms/score/?md5=${entry.md5}`
        : null,
      difficultyTables: entry.difficultyTables,
    })
  );

  res.json({
    result: "success",
    msg: "",
    data: formattedResult,
  });
});

export { router };
