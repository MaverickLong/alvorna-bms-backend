"use strict";

import { Router } from "express";
import { DI } from "../index.js";
import { Chart } from "../entities/Chart.entity.js";

const router = Router();

router.get("/tables", async (req, res) => {
  res.json(DI.tables.findAll());
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

// router.get("/search", async (req, res) => {
//   const PAGE_SIZE = 20;
//   const page = req.query.page ? parseInt(req.query.page as string) : 1;

//   const offset = (page - 1) * PAGE_SIZE;

//   const query = {
//     md5: req.query.md5,
//     sha256: req.query.sha256,
//     name: req.query.name ? req.query.name : "",
//     difficultyTable: req.query.difficultyTable ? req.query.difficultyTable : "",
//   } as {
//     md5?: string;
//     sha256?: string;
//     name: string;
//     difficultyTable: string;
//   };

//   const result = await DI.em.find(
//     Chart,
//     {
//       md5: query.md5 as string,
//       sha256: query.sha256 as string,
//       [raw("lower(name)")]: DI.em
//         .getKnex()
//         .raw("like ?", [`%${query.name.toLowerCase()}%`]),
//       difficultyTables: {
//         $some: {
//           [raw("lower(originalUrl)")]: DI.em
//             .getKnex()
//             .raw("like ?", [`%${query.difficultyTable.toLowerCase()}%`]),
//         },
//       },
//     },
//     {
//       limit: PAGE_SIZE,
//       offset: offset,
//     }
//   );

//   res.json(result);
// });

export { router };
