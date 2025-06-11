import {
  BaseEntity,
  Collection,
  Entity,
  ManyToMany,
  OneToMany,
  Property,
  Ref,
} from "@mikro-orm/core";
import { Chart } from "./Chart.js";
import { DifficultyTable } from "./DifficultyTable.js";

@Entity()
export class Song extends BaseEntity {
  @Property()
  title!: string;

  @OneToMany(() => Chart, (chart) => chart.song)
  charts = new Collection<Chart>(this);

  @Property()
  packagePath?: string;

  @ManyToMany(() => DifficultyTable, (difficultyTable) => difficultyTable.songs)
  difficultyTables = new Collection<DifficultyTable>(this);
}
