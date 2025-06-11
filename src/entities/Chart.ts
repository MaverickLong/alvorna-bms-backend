import { BaseEntity, Entity, ManyToOne, Property } from "@mikro-orm/core";
import { Song } from "./Song.js";

@Entity()
export class Chart extends BaseEntity {
  @Property()
  title?: string;

  @Property()
  md5!: string;

  @Property()
  sha1!: string;

  @ManyToOne()
  song!: Song;
}
