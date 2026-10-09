import { storyOpen } from "./progress";

export interface Chapter {
  id: string;
  countryId: string;
  country: string;
  index: number;
  theater: string;
  line: string;
  beats: [string, string, string];
  video: string;
  mid: string | null;
  hudson: string;
  water: "river" | "coast" | "lakes";
  waterAmt: number;
  forest: number;
  peaks: number;
  salt: number;
  sky: [string, string];
  ground: [number, number, number];
  canopy: string;
  trunk: string;
  waterFill: string;
  snow: boolean;
}

interface Skin {
  country: string;
  water: Chapter["water"];
  waterAmt: number;
  forest: number;
  peaks: number;
  salt: number;
  sky: [string, string];
  ground: [number, number, number];
  canopy: string;
  trunk: string;
  waterFill: string;
  snow: boolean;
}

interface Row {
  theater: string;
  line: string;
  brief: string;
  hudson: string;
  video?: string;
  mid?: string;
}

function arc(countryId: string, skin: Skin, rows: Row[]): Chapter[] {
  return rows.map((row, i) => ({
    ...skin,
    id: `${countryId}-${String(i + 1).padStart(2, "0")}`,
    countryId,
    index: i + 1,
    theater: row.theater,
    line: row.line,
    beats: [row.brief, row.line, row.hudson],
    video: row.video ?? "",
    mid: row.mid ?? null,
    hudson: row.hudson,
    salt: skin.salt + i * 0.37,
    forest: Math.min(0.9, skin.forest + (i % 3) * 0.03),
    peaks: Math.min(0.95, skin.peaks + (i % 2) * 0.04),
  }));
}

const usa = arc("usa", {
  country: "United States",
  water: "river", waterAmt: 0.7, forest: 0.62, peaks: 0.7, salt: 2.1,
  sky: ["#1c3348", "#8aa4b4"], ground: [92, 108, 78], canopy: "#2f5a3a", trunk: "#4a3424", waterFill: "#1a5870", snow: true,
}, [
  { theater: "Cascade Reach", line: "Snow, cedar, and a ford the tanks have to take.", brief: "Helion drops west of the Cascade. Ionite sits under the snow, and the river is the first wall.", hudson: "The ford is ours. Hudson says the cedar line is next, and it will not be quiet.", video: "usa" },
  { theater: "Cedar Ford", line: "Night tracks and a beacon in the trees.", brief: "The column moves after dark. Follow the glass beacon. Do not light the ridge.", hudson: "They heard the tracks. Hudson wants the high shelf before dawn.", video: "usa-02" },
  { theater: "Glass Shelf", line: "Tanks on the snow above the pines.", brief: "The shelf is the only clean ground. Hold it and the pass stays yours.", hudson: "Shelf held. The pass is a throat. Hudson says send the infantry first.", video: "usa-03" },
  { theater: "White Pass", line: "A narrow cut between rock walls.", brief: "One lane through the pass. Infantry clears it. Tanks wait until the walls are quiet.", hudson: "The pass is open. Their relay is still talking. Hudson wants it dark.", video: "usa-04" },
  { theater: "Relay Cut", line: "A wounded dish above the column.", brief: "Kill the relay before it calls their air. The dish is on the ridge, not in the trees.", hudson: "The dish is silent. Hudson says their air is already up. Look north.", video: "usa-05" },
  { theater: "North Glass", line: "Aircraft over the white valley.", brief: "Their air comes down the valley. Keep a lance on the pad and do not bunch the tanks.", hudson: "The valley is quiet. Hudson says the spire doors are in sight.", mid: "mid-ridge", video: "usa-06" },
  { theater: "Spire Steps", line: "The glass doors in the snow.", brief: "This is the first spire of the Cascade. Crack it and the campaign turns.", hudson: "First spire down. Hudson says the harbor ice is the next road.", video: "usa-07" },
  { theater: "Cold Harbor", line: "A tower on the dawn ridge.", brief: "They rebuilt on the harbor ridge. Take the dawn ground before the ice breaks.", hudson: "Harbor ridge is Helion. The switchback is the only way down.", video: "usa-08" },
  { theater: "Switchback", line: "A road cut above the river.", brief: "The switchback is slow. Do not rush the turn. Their guns like a line of tanks.", hudson: "The road is ours. Hudson says the last ford is quiet, and that is a lie.", video: "usa-09" },
  { theater: "Quiet Ford", line: "Shallow water and a spire in the cloud.", brief: "Cross the ford under the cloud. The spire is on the far peak. End this half of the Cascade.", hudson: "Half the Cascade is held. The vein under the second range is next.", mid: "mid-ridge", video: "usa-10" },
  { theater: "Vein Cut", line: "Ionite under the second range.", brief: "The second range hides a vein of ionite. Lamps on. Do not wake the slope.", hudson: "The vein is marked. Hudson says the next pad has no trees.", video: "usa-11" },
  { theater: "Black Pad", line: "A pad with no trees.", brief: "No cover on this pad. Build walls before you park the tanks.", hudson: "The pad is held. The last cedar is the next wall.", video: "usa-12" },
  { theater: "Last Cedar", line: "The final tree line.", brief: "This is the last cedar. Infantry takes the trunks. Tanks wait.", hudson: "The trees are ours. A storm is on the shelf.", video: "usa-13" },
  { theater: "Storm Shelf", line: "Weather on the high ground.", brief: "The shelf is in weather. Hold the tanks and wait for the cloud to break on their tower.", hudson: "The storm passed. Their second dish is still talking.", video: "usa-14" },
  { theater: "Broken Relay", line: "A second dish.", brief: "One dish is already dead. Kill the second before it finishes the call.", hudson: "Both dishes are dark. Three peaks, one road.", video: "usa-15" },
  { theater: "Peak Line", line: "Three peaks, one road.", brief: "One road climbs three peaks. Do not bunch the column on the turns.", hudson: "The road is open. Their yard sits in the lee.", video: "usa-16" },
  { theater: "Soot Yard", line: "Their yard in the lee.", brief: "The yard is under the cliff. Hit it before those tanks roll.", hudson: "The yard is scrap. Twin falls are the next cut.", video: "usa-17" },
  { theater: "Twin Falls", line: "Two cuts of water.", brief: "Two frozen falls and one ford. Cross between them.", hudson: "The ford is held. Their yard before the crown is next.", video: "usa-18" },
  { theater: "Vesper Yard", line: "The yard before the crown.", brief: "This yard guards the crown. Break it and the last glass is in reach.", hudson: "The yard is down. Hudson says take the crown.", video: "usa-19" },
  { theater: "Cascade Crown", line: "The last glass in the range.", brief: "The crown is the last spire in the Cascade. Crack it and the range is Helion.", hudson: "Cascade is closed. Hudson has no further brief on this range.", video: "usa-20" },
]);

const russia = arc("russia", {
  country: "Russia",
  water: "river", waterAmt: 0.55, forest: 0.42, peaks: 0.9, salt: 5.4,
  sky: ["#243246", "#c5d0d8"], ground: [150, 156, 150], canopy: "#6d7c68", trunk: "#5c4030", waterFill: "#8ea8b8", snow: true,
}, [
  { theater: "White Meridian", line: "A frozen cut, birch, and a ridge that does not forgive.", brief: "White Meridian. The river is a sheet of ice and the birch is thin cover.", hudson: "Meridian is held. Hudson says take the ice road before it snows shut.", video: "russia" },
  { theater: "Ice Road", line: "Tanks between the birch.", brief: "Stay on the ice road. The birch hides their rockets, not your armor.", hudson: "The road is clear. Hudson wants the birch cut walked, not driven.", video: "russia-02" },
  { theater: "Birch Cut", line: "Thin trees and a frozen river.", brief: "Infantry owns this cut. Tanks wait on the hard ground behind them.", hudson: "The cut is ours. Their guns are on the ridge. Hudson says look up.", video: "russia-03" },
  { theater: "Ridge Guns", line: "Barrels over a pale valley.", brief: "Silence the ridge before you cross the valley. A push under those guns dies.", hudson: "The ridge is quiet. One spire left in the ice.", mid: "mid-ridge", video: "russia-04" },
  { theater: "Frozen Glass", line: "A spire locked in the ice.", brief: "The spire is in the ice. Crack it and this half of the meridian closes.", hudson: "Half of White Meridian is held. The ice dock is next.", video: "russia-05" },
  { theater: "Pale Dock", line: "A dock on the ice.", brief: "The dock is their supply on the ice. Take it before the birch ends.", hudson: "The dock is ours. The birch stops just ahead.", video: "russia-06" },
  { theater: "Birch End", line: "Where the trees stop.", brief: "Where the birch ends, you are in the open. Do not cross until the guns are quiet.", hudson: "The tree line held. The upper ice is the next road.", video: "russia-07" },
  { theater: "High Ice", line: "The upper sheet.", brief: "The high ice is a sheet with no cover. Cross fast and do not stop.", hudson: "The sheet is crossed. The far meridian is in sight.", video: "russia-08" },
  { theater: "South Meridian", line: "The far side of the line.", brief: "This is the far side. Their last glass is across the pale ground.", hudson: "The far side is held. One crown left in the cold.", video: "russia-09" },
  { theater: "White Crown", line: "The last glass in the cold.", brief: "The white crown is the last spire on the meridian. Crack the ice and end it.", hudson: "White Meridian is closed. Hudson is done with the cold.", video: "russia-10" },
]);

const china = arc("china", {
  country: "China",
  water: "lakes", waterAmt: 0.8, forest: 0.4, peaks: 0.35, salt: 6.6,
  sky: ["#1a3040", "#9eb8a8"], ground: [110, 120, 78], canopy: "#3d7a40", trunk: "#4a3428", waterFill: "#1c6878", snow: false,
}, [
  { theater: "Pearl Shelf", line: "Delta water, terrace rock, and a long approach.", brief: "Pearl Shelf. The delta splits the ground into fingers. Ionite sits on the dry ones.", hudson: "The first shelf is held. Hudson says the next finger is longer.", video: "china" },
  { theater: "Delta Finger", line: "Dry ground between the water.", brief: "Do not fight in the water. Hold the terrace and walk the finger.", hudson: "The finger is ours. The second terrace is next.", mid: "mid-ridge", video: "china-02" },
  { theater: "Terrace Two", line: "The second shelf.", brief: "The second terrace is dry. Hold it. The water is not a road.", hudson: "Second shelf held. The next finger is wet.", video: "china-03" },
  { theater: "Low Finger", line: "A wet approach.", brief: "Walk the dry center of the finger. The edges are water.", hudson: "The finger is crossed. Their pad is in the mist.", video: "china-04" },
  { theater: "Mist Pad", line: "A pad in the mist.", brief: "Build in the mist and keep the lights low. They hear engines.", hudson: "The pad is up. The spire has left the water.", video: "china-05" },
  { theater: "Inland Glass", line: "The spire leaves the water.", brief: "The glass is inland now. Take the dry terraces, not the river.", hudson: "Inland ground is ours. The approach is long and open.", video: "china-06" },
  { theater: "Long Approach", line: "A straight push dies here.", brief: "Do not push straight. The terrace guns own a straight line.", hudson: "The approach is taken. Their guns are still on the shelf.", video: "china-07" },
  { theater: "Shelf Fire", line: "Guns on the terrace.", brief: "Silence the terrace guns before the last channel.", hudson: "The guns are quiet. The delta is closing.", video: "china-08" },
  { theater: "Delta End", line: "Where the water closes.", brief: "One channel left. Hold the last dry bank.", hudson: "The channel is held. The crown is inland.", video: "china-09" },
  { theater: "Pearl Crown", line: "The last glass inland.", brief: "The pearl crown is the last spire off the water. Break it.", hudson: "Pearl Shelf is closed. Hudson is done with the delta.", video: "china-10" },
]);

const australia = arc("australia", {
  country: "Australia",
  water: "lakes", waterAmt: 0.35, forest: 0.28, peaks: 0.45, salt: 8.2,
  sky: ["#3a2418", "#e0a070"], ground: [168, 96, 58], canopy: "#6a7a38", trunk: "#6a4030", waterFill: "#2a6a78", snow: false,
}, [
  { theater: "Red Interior", line: "Red dirt, a dry creek, and mesas instead of a forest.", brief: "Red Interior. The creek is low and the ionite glows in the scrub.", hudson: "The creek is held. Hudson says the next mesa has their tanks.", video: "australia" },
  { theater: "Dry Creek", line: "Sunset on the low water.", brief: "Use the creek as a road, not a fight. The mesa tower sees the open dirt.", hudson: "Creek crossed. Line the tanks on the mesa shadow.", video: "australia-02" },
  { theater: "Mesa Line", line: "Armor under the rock.", brief: "Keep the tanks in the shade of the mesa. Their guns like a silhouette.", hudson: "The line held. The creek bed is the only covered road left.", mid: "mid-ridge", video: "australia-03" },
  { theater: "Creek Road", line: "Infantry in the dry bed.", brief: "Walk the bed. The walls hide you. Do not climb until the bend.", hudson: "The bed is clear. One mesa left.", video: "australia-04" },
  { theater: "Last Mesa", line: "The glass on the far rock.", brief: "The last mesa is the spire. Break it and the interior is yours.", hudson: "Red Interior is closed. Hudson has nothing left to cut out here.", video: "australia-05" },
]);

function short(countryId: string, skin: Skin, first: Row, rest: [string, string, string][]): Chapter[] {
  return arc(countryId, skin, [
    first,
    ...rest.map(([theater, line, video]) => ({
      theater,
      line,
      brief: line,
      hudson: `${theater} is held. The next brief stays sealed until this film is watched or this ground is won.`,
      video,
    })),
  ]);
}

const korea = short("korea", {
  country: "South Korea",
  water: "river", waterAmt: 0.85, forest: 0.7, peaks: 0.55, salt: 3.3,
  sky: ["#163044", "#7ea0b0"], ground: [78, 108, 72], canopy: "#1f6a3c", trunk: "#3e2a1c", waterFill: "#186080", snow: false,
}, { theater: "Han Line", line: "A wide river, dense cover, and a ridge on the far bank.", brief: "The Han Line is a wet cut. Helion holds the near bank. The glass is across the water.", hudson: "The near bank is held. The first ford is next.", video: "korea" }, [
  ["Ford Light", "The first crossing.", "korea-02"],
  ["Tree Bank", "Infantry in the cover.", "korea-03"],
  ["Far Ridge", "Guns over the water.", "korea-04"],
  ["Han Glass", "The spire on the ridge.", "korea-05"],
]);

const japan = short("japan", {
  country: "Japan",
  water: "coast", waterAmt: 0.75, forest: 0.66, peaks: 0.8, salt: 4.4,
  sky: ["#1a2838", "#d0a0a8"], ground: [86, 104, 70], canopy: "#245c34", trunk: "#3a2818", waterFill: "#14586e", snow: false,
}, { theater: "Inland Sea", line: "Coast, cedar, and a volcanic ridge.", brief: "Inland Sea. Helion lands on the coast. The water is at your back and the ridge is ahead.", hudson: "The beach is held. The cedar shelf is next.", video: "japan" }, [
  ["Cedar Shelf", "Trees above the water.", "japan-02"],
  ["Low Air", "Aircraft off the sea.", "japan-03"],
  ["Volcanic Cut", "The rock road.", "japan-04"],
  ["Sea Glass", "The spire in the ridge.", "japan-05"],
]);

const uk = short("uk", {
  country: "United Kingdom",
  water: "coast", waterAmt: 0.5, forest: 0.3, peaks: 0.25, salt: 1.2,
  sky: ["#2a3340", "#9aa6b0"], ground: [96, 108, 78], canopy: "#3e6244", trunk: "#3c3024", waterFill: "#3a5a68", snow: false,
}, { theater: "North Glass", line: "Grey water, low moor, and a short horizon.", brief: "North Glass. Low cloud, a grey cut of water, and ionite in the moor.", hudson: "The moor is held. The grey cut is next.", video: "uk" }, [
  ["Grey Cut", "Water at the flank.", "uk-02"],
  ["Moor Pad", "Open ground, so build walls.", "uk-03"],
  ["Short Lane", "The push is not long.", "uk-04"],
  ["Low Spire", "The glass is close.", "uk-05"],
]);

const india = short("india", {
  country: "India",
  water: "river", waterAmt: 0.8, forest: 0.48, peaks: 0.4, salt: 7.7,
  sky: ["#243028", "#e0c080"], ground: [140, 120, 64], canopy: "#4a7a32", trunk: "#5a3c24", waterFill: "#1a7068", snow: false,
}, { theater: "Deccan Shelf", line: "A monsoon river, hard plateau, and a long gun line.", brief: "Deccan Shelf. The river is up. The plateau is the only clean ground for a base.", hudson: "The shelf is held. The monsoon road is next.", video: "india" }, [
  ["Monsoon Road", "The river stays high.", "india-02"],
  ["Scrub Line", "Infantry off the shelf.", "india-03"],
  ["Gun Shelf", "Tanks stay up high.", "india-04"],
  ["Last Rise", "The spire past the rise.", "india-05"],
]);

const france = short("france", {
  country: "France",
  water: "river", waterAmt: 0.6, forest: 0.55, peaks: 0.5, salt: 9.1,
  sky: ["#1e3044", "#b7c4c8"], ground: [100, 112, 70], canopy: "#2f6840", trunk: "#3e2c1e", waterFill: "#1a6074", snow: false,
}, { theater: "Atlantic Cut", line: "An estuary, hedgerows, and a stone ridge.", brief: "Atlantic Cut. The estuary floods the low ground. Helion builds on the hedgerow shelf.", hudson: "The shelf is held. The hedgerow is next.", video: "france" }, [
  ["Hedgerow", "Trees used as walls.", "france-02"],
  ["Estuary", "Do not fight in the flood.", "france-03"],
  ["Stone Road", "The ridge road.", "france-04"],
  ["Crown Glass", "The spire on the stone.", "france-05"],
]);

const brazil = short("brazil", {
  country: "Brazil",
  water: "river", waterAmt: 0.9, forest: 0.86, peaks: 0.3, salt: 10.5,
  sky: ["#102018", "#6a9870"], ground: [62, 92, 48], canopy: "#145028", trunk: "#2e2014", waterFill: "#0e5048", snow: false,
}, { theater: "Green Margin", line: "Heavy canopy, a dark river, and almost no open ground.", brief: "Green Margin. The canopy hides both sides. The river is the only clean line on the map.", hudson: "The river line is held. Cut the first lane next.", video: "brazil" }, [
  ["First Lane", "Cut a lane before the tanks.", "brazil-02"],
  ["Dark Water", "The river is the map.", "brazil-03"],
  ["Canopy Yard", "Infantry can live here.", "brazil-04"],
  ["Green Scar", "The spire in the trees.", "brazil-05"],
]);

const AUS: Pick<Chapter, "water" | "waterAmt" | "forest" | "peaks" | "sky" | "ground" | "canopy" | "trunk" | "waterFill" | "snow"> = {
  water: "coast",
  waterAmt: 0.72,
  forest: 0.46,
  peaks: 0.28,
  sky: ["#1d3344", "#d7b56a"],
  ground: [150, 118, 72],
  canopy: "#6a7040",
  trunk: "#6a4a30",
  waterFill: "#1a6880",
  snow: false,
};

const TIES: Record<string, { foe: string; ally: string }> = {
  usa: { foe: "China", ally: "Australia and the United Kingdom" },
  russia: { foe: "the United States", ally: "China" },
  china: { foe: "Japan", ally: "Russia" },
  australia: { foe: "China", ally: "the United States and the United Kingdom" },
  korea: { foe: "China", ally: "Japan and the United States" },
  japan: { foe: "China", ally: "Australia and South Korea" },
  uk: { foe: "Russia", ally: "Australia and France" },
  india: { foe: "China", ally: "Australia and the United Kingdom" },
  france: { foe: "Russia", ally: "the United Kingdom and Australia" },
  brazil: { foe: "China", ally: "Australia and the United States" },
};

function withAustralia(chapters: Chapter[]): Chapter[] {
  const first = chapters[0];
  const ties = TIES[first.countryId];
  const opened = chapters.map((chapter, index) =>
    index === 0 ? { ...chapter, video: `${chapter.countryId}-long` } : chapter,
  );
  const extra: Array<[string, string, string, string]> = [
    [
      "Melbourne Port",
      `${ties.foe} holds the port. ${ties.ally} are on your flank.`,
      `Melbourne. ${ties.foe} owns the docks. ${ties.ally} hold the river road with you. Take the port, do not fire on the ally column.`,
      "The port is yours. Hudson says Sydney is the next harbour, and the ally line moves with you.",
    ],
    [
      "Sydney Harbour",
      `The bridge is the fight. ${ties.foe} is on the north shore.`,
      `Sydney. ${ties.ally} hold the bridge. ${ties.foe} is pushing the north shore. Keep the harbour cargo moving.`,
      "The harbour is held. Hudson says Queensland is the long coast, and the ally ships are already turning north.",
    ],
    [
      "Queensland Coast",
      `Reef road, cargo, and ${ties.foe} on the range.`,
      `Queensland. The coast road is the only clean line. ${ties.ally} guard the cargo. Break ${ties.foe} before the range guns find the ships.`,
      "The coast is held. This Australian front is closed.",
    ],
  ];
  return [
    ...opened,
    ...extra.map(([theater, line, brief, hudson], i) => ({
      ...first,
      ...AUS,
      id: `${first.countryId}-au${i + 1}`,
      index: opened.length + i + 1,
      theater,
      line,
      beats: [brief, line, hudson] as [string, string, string],
      video: `${first.countryId}-${["melbourne", "sydney", "queensland"][i]}`,
      mid: null,
      hudson,
      salt: first.salt + 4 + i,
    })),
  ];
}

export const COUNTRIES: { id: string; chapters: Chapter[] }[] = [
  { id: "usa", chapters: withAustralia(usa) },
  { id: "russia", chapters: withAustralia(russia) },
  { id: "china", chapters: withAustralia(china) },
  { id: "australia", chapters: withAustralia(australia) },
  { id: "korea", chapters: withAustralia(korea) },
  { id: "japan", chapters: withAustralia(japan) },
  { id: "uk", chapters: withAustralia(uk) },
  { id: "india", chapters: withAustralia(india) },
  { id: "france", chapters: withAustralia(france) },
  { id: "brazil", chapters: withAustralia(brazil) },
];

export const CHAPTERS: Chapter[] = COUNTRIES.flatMap((c) => c.chapters);

export function chapterById(id: string | undefined): Chapter {
  return CHAPTERS.find((c) => c.id === id) ?? CHAPTERS[0];
}

export function countryOf(id: string): Chapter[] {
  return COUNTRIES.find((c) => c.id === id)?.chapters ?? CHAPTERS.filter((c) => c.countryId === "usa");
}

export function isOpen(chapters: Chapter[], index: number): boolean {
  const chapter = chapters[index];
  if (!chapter?.video) return false;
  if (index === 0) return true;
  const prev = chapters[index - 1];
  if (!prev?.video) return false;
  return storyOpen(prev.id);
}

export function nextPlayable(id: string): Chapter | null {
  const current = chapterById(id);
  const chapters = countryOf(current.countryId);
  const index = chapters.findIndex((c) => c.id === id);
  const next = chapters[index + 1];
  if (!next || !isOpen(chapters, index + 1)) return null;
  return next;
}
