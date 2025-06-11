import {
  BaseEntity,
  Collection,
  Entity,
  ManyToMany,
  Property,
} from "@mikro-orm/core";
import { Song } from "./Song.js";

@Entity()
export class DifficultyTable extends BaseEntity {
  @Property()
  title!: string;

  @Property()
  originalUrl!: string;

  @Property()
  proxiedUrl!: string;

  @ManyToMany()
  songs = new Collection<Song>(this);
}
