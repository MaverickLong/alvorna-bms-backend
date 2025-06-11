import { MikroORM, RequestContext } from "@mikro-orm/postgresql";
import mikroOrmConfig from "./mikro-orm.config.js";
import express from "express";

// initialize the ORM, loading the config file dynamically
const orm = await MikroORM.init(mikroOrmConfig);
const app = express();

app.use((req, res, next) => {
  RequestContext.create(orm.em, next);
});
