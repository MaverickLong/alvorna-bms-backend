"use strict";

import {
  BaseEntity,
  Collection,
  Entity,
  ManyToMany,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { Chart } from "./Chart.js";

@Entity()
export class DifficultyTable extends BaseEntity {
  // Name of the difficulty table.
  @Property()
  name!: string;

  // Original URL fetched from the config.
  // Do note that this might be the HTML containing reference to the header, or the header itself.
  @PrimaryKey()
  originalUrl!: string;

  // This is the proxied URL that we generates, stored in a static location.
  @Property()
  proxiedUrl!: string;

  // MD5 of the main JSON (not header) of the difficulty table.
  @Property()
  md5!: string;

  // The charts contained in the difficulty table.
  @ManyToMany()
  charts = new Collection<Chart>(this);
}
