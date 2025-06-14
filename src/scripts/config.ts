export default {
  listen: "0.0.0.0",
  port: 12306,
  bmsChartStorage: "/data-bms/charts/",
  bmsZippedFilesStorage: "/data-bms/zipped-packages/",
  bmsExtractedFilesStorage: "/data-bms/extracted-packages/",
  bmsPendingFilesStorage: "/data-bms/pending-packages/",
  bmsDiffTableStorage: "/data-bms/diff-tables/",
  urlPrefix: "https://bms.alvorna.com/",
  bmsWebViewerUrl: "https://bms.alvorna.com/bms/score/view?md5=",
  postgreSqlConfig: {
    user: "",
    password: "",
    database: "",
  },
  diffTables: [
    "http://rattoto10.jounin.jp/table_overjoy.html",
    "http://rattoto10.jounin.jp/table.html",
    "http://rattoto10.jounin.jp/table_insane.html",
    "https://stellabms.xyz/sl/table.html",
    "https://stellabms.xyz/st/table.html",
    "http://kaguyasystem.web.fc2.com/tohonannidohyou1/list.html",
  ],
  acceptedBmsExtNames: [".bms", ".bme", ".bml", ".pms", ".bmx"],
  proxy: {
    host: "127.0.0.1",
    port: 8001,
  },
};
