"use strict";

import { Router } from "express";
import { DI } from "../index.js";
import { Song } from "../entities/Song.js";

const router = Router();

router.get("/tables", async (req, res) => {
  res.json(DI.tables.findAll());
});

router.get("/search", async (req, res) => {
  const PAGE_SIZE = 20;
  const page = req.query.page ? parseInt(req.query.page as string) : 1;

  const offset = (page - 1) * PAGE_SIZE;

  const constraint = {} as {
    name?: string;
    table?: string;
  };
  if (req.query.name) {
    constraint.name = req.query.name as string;
  }
  if (req.query.table) {
    constraint.table = req.query.table as string;
  }

  const result = await DI.em.find(Song, constraint, {
    limit: PAGE_SIZE,
    offset: offset,
  });

  res.json(result);
});
