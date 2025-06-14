"use strict";

import {
  BaseEntity,
  Collection,
  Entity,
  ManyToMany,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { Song } from "./Song.entity.js";
import { DifficultyTable } from "./DifficultyTable.entity.js";
import { v4 } from "uuid";

@Entity()
export class Chart extends BaseEntity {
  @PrimaryKey()
  uuid = v4();
  // Potentially a name for the chart. Might just use file name?
  @Property()
  name?: string;

  // Hashes for the chart file.
  @Property()
  md5?: string;
  @Property()
  sha1?: string;

  // The song package that contains the chart.
  // TODO: Could there be two packages containing the same chart?
  // In which case we should merge the two song packages.
  @ManyToOne()
  song?: Song;

  // The difficulty tables that listed this chart.
  @ManyToMany(
    () => DifficultyTable,
    (difficultyTable) => difficultyTable.charts
  )
  difficultyTables = new Collection<DifficultyTable>(this);
}
