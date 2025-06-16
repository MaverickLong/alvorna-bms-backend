"use strict";

import {
  EntityManager,
  EntityRepository,
  MikroORM,
  RequestContext,
} from "@mikro-orm/postgresql";
import mikroOrmConfig from "./mikro-orm.config.js";
import express from "express";
import { DifficultyTable } from "./entities/DifficultyTable.entity.js";
import { Song } from "./entities/Song.entity.js";
import { router } from "./routes/api.js";

export const DI = {} as {
  orm: MikroORM;
  em: EntityManager;
  tables: EntityRepository<DifficultyTable>;
  songs: EntityRepository<Song>;
};

const PORT = process.env.PORT ?? 3000;

DI.orm = await MikroORM.init(mikroOrmConfig);
DI.em = DI.orm.em;
DI.tables = DI.em.getRepository(DifficultyTable);
DI.songs = DI.em.getRepository(Song);

await DI.orm.schema.updateSchema();

export const app = express();

app.use((_req, _res, next) => RequestContext.create(DI.orm.em, next));

app.use("/api", router);

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
