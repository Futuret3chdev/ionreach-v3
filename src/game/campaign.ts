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
    mid: null,
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
  { theater: "Cedar Ford", line: "Night tracks and a beacon in the trees.", brief: "The column moves after dark. Follow the glass beacon. Do not light the ridge.", hudson: "They heard the tracks. Hudson wants the high shelf before dawn.", video: "usa-02-brief" },
  { theater: "Glass Shelf", line: "Tanks on the snow above the pines.", brief: "The shelf is the only clean ground. Hold it and the pass stays yours.", hudson: "Shelf held. The pass is a throat. Hudson says send the infantry first.", video: "usa-03-brief" },
  { theater: "White Pass", line: "A narrow cut between rock walls.", brief: "One lane through the pass. Infantry clears it. Tanks wait until the walls are quiet.", hudson: "The pass is open. Their relay is still talking. Hudson wants it dark.", video: "usa-04-brief" },
  { theater: "Relay Cut", line: "A wounded dish above the column.", brief: "Kill the relay before it calls their air. The dish is on the ridge, not in the trees.", hudson: "The dish is silent. Hudson says their air is already up. Look north.", video: "usa-05-brief" },
  { theater: "North Glass", line: "Aircraft over the white valley.", brief: "Their air comes down the valley. Keep a lance on the pad and do not bunch the tanks.", hudson: "The valley is quiet. Hudson says the spire doors are in sight.", video: "usa-06-brief" },
  { theater: "Spire Steps", line: "The glass doors in the snow.", brief: "This is the first spire of the Cascade. Crack it and the campaign turns.", hudson: "First spire down. Hudson says the harbor ice is the next road.", video: "usa-07-brief" },
  { theater: "Cold Harbor", line: "A tower on the dawn ridge.", brief: "They rebuilt on the harbor ridge. Take the dawn ground before the ice breaks.", hudson: "Harbor ridge is Helion. The switchback is the only way down.", video: "usa-08-brief" },
  { theater: "Switchback", line: "A road cut above the river.", brief: "The switchback is slow. Do not rush the turn. Their guns like a line of tanks.", hudson: "The road is ours. Hudson says the last ford is quiet, and that is a lie.", video: "usa-09-brief" },
  { theater: "Quiet Ford", line: "Shallow water and a spire in the cloud.", brief: "Cross the ford under the cloud. The spire is on the far peak. End this half of the Cascade.", hudson: "Half the Cascade is held. The vein under the second range is next.", video: "usa-10-brief" },
  { theater: "Vein Cut", line: "Ionite under the second range.", brief: "The second range hides a vein of ionite. Lamps on. Do not wake the slope.", hudson: "The vein is marked. Hudson says the next pad has no trees.", video: "usa-11-brief" },
  { theater: "Black Pad", line: "A pad with no trees.", brief: "No cover on this pad. Build walls before you park the tanks.", hudson: "The pad is held. The last cedar is the next wall.", video: "usa-12-brief" },
  { theater: "Last Cedar", line: "The final tree line.", brief: "This is the last cedar. Infantry takes the trunks. Tanks wait.", hudson: "The trees are ours. A storm is on the shelf.", video: "usa-13-brief" },
  { theater: "Storm Shelf", line: "Weather on the high ground.", brief: "The shelf is in weather. Hold the tanks and wait for the cloud to break on their tower.", hudson: "The storm passed. Their second dish is still talking.", video: "usa-14-brief" },
  { theater: "Broken Relay", line: "A second dish.", brief: "One dish is already dead. Kill the second before it finishes the call.", hudson: "Both dishes are dark. Three peaks, one road.", video: "usa-15-brief" },
  { theater: "Peak Line", line: "Three peaks, one road.", brief: "One road climbs three peaks. Do not bunch the column on the turns.", hudson: "The road is open. Their yard sits in the lee.", video: "usa-16-brief" },
  { theater: "Soot Yard", line: "Their yard in the lee.", brief: "The yard is under the cliff. Hit it before those tanks roll.", hudson: "The yard is scrap. Twin falls are the next cut.", video: "usa-17-brief" },
  { theater: "Twin Falls", line: "Two cuts of water.", brief: "Two frozen falls and one ford. Cross between them.", hudson: "The ford is held. Their yard before the crown is next.", video: "usa-18-brief" },
  { theater: "Vesper Yard", line: "The yard before the crown.", brief: "This yard guards the crown. Break it and the last glass is in reach.", hudson: "The yard is down. Hudson says take the crown.", video: "usa-19-brief" },
  { theater: "Cascade Crown", line: "The last glass in the range.", brief: "The crown is the last spire in the Cascade. Crack it and the range is Helion.", hudson: "Cascade is closed. Hudson has no further brief on this range.", video: "usa-20-brief" },
]);

const russia = arc("russia", {
  country: "Russia",
  water: "river", waterAmt: 0.55, forest: 0.42, peaks: 0.9, salt: 5.4,
  sky: ["#243246", "#c5d0d8"], ground: [150, 156, 150], canopy: "#6d7c68", trunk: "#5c4030", waterFill: "#8ea8b8", snow: true,
}, [
  { theater: "White Meridian", line: "A frozen cut, birch, and a ridge that does not forgive.", brief: "White Meridian. The river is a sheet of ice and the birch is thin cover.", hudson: "Meridian is held. Hudson says take the ice road before it snows shut.", video: "russia" },
  { theater: "Ice Road", line: "Tanks between the birch.", brief: "Stay on the ice road. The birch hides their rockets, not your armor.", hudson: "The road is clear. Hudson wants the birch cut walked, not driven.", video: "russia-02" },
  { theater: "Birch Cut", line: "Thin trees and a frozen river.", brief: "Infantry owns this cut. Tanks wait on the hard ground behind them.", hudson: "The cut is ours. Their guns are on the ridge. Hudson says look up.", video: "russia-03" },
  { theater: "Ridge Guns", line: "Barrels over a pale valley.", brief: "Silence the ridge before you cross the valley. A push under those guns dies.", hudson: "The ridge is quiet. One spire left in the ice.", video: "russia-04" },
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
  { theater: "Delta Finger", line: "Dry ground between the water.", brief: "Do not fight in the water. Hold the terrace and walk the finger.", hudson: "The finger is ours. The second terrace is next.", video: "china-02" },
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
  { theater: "Mesa Line", line: "Armor under the rock.", brief: "Keep the tanks in the shade of the mesa. Their guns like a silhouette.", hudson: "The line held. The creek bed is the only covered road left.", video: "australia-03" },
  { theater: "Creek Road", line: "Infantry in the dry bed.", brief: "Walk the bed. The walls hide you. Do not climb until the bend.", hudson: "The bed is clear. One mesa left.", video: "australia-04" },
  { theater: "Last Mesa", line: "The glass on the far rock.", brief: "The last mesa is the spire. Break it and the interior is yours.", hudson: "Red Interior is closed. Hudson has nothing left to cut out here.", video: "australia-05" },
]);

const korea = arc("korea", {
  country: "South Korea",
  water: "river", waterAmt: 0.85, forest: 0.7, peaks: 0.55, salt: 3.3,
  sky: ["#163044", "#7ea0b0"], ground: [78, 108, 72], canopy: "#1f6a3c", trunk: "#3e2a1c", waterFill: "#186080", snow: false,
}, [
  { theater: "Han Line", line: "A wide river, dense cover, and a ridge on the far bank.", brief: "The Han is in flood. Helion holds the near bank. The glass is across the water, not up the road.", hudson: "The near bank is held. Hudson says the first ford is a lamp, not a bridge.", video: "korea" },
  { theater: "Ford Light", line: "One lit crossing in the dark water.", brief: "Cross where the lamp hits the river. A second column in the dark gets cut apart.", hudson: "The ford is taken. The tree bank on the far side is the next wall.", video: "korea-02" },
  { theater: "Tree Bank", line: "Infantry under the far-side canopy.", brief: "Leave the tanks on the gravel. Infantry takes the trunks before anything heavy rolls up.", hudson: "The bank is ours. Their guns sit on the ridge above the water.", video: "korea-03" },
  { theater: "Far Ridge", line: "Guns looking back down the Han.", brief: "Silence the ridge before you show armor on the bank. Those guns own the river.", hudson: "The ridge is quiet. The last glass is on the same hill.", video: "korea-04" },
  { theater: "Han Glass", line: "The spire above the last bend.", brief: "The Han spire is the end of this river. Crack it and the line closes.", hudson: "The Han is closed. Hudson has no further brief on this water.", video: "korea-05" },
]);

const japan = arc("japan", {
  country: "Japan",
  water: "coast", waterAmt: 0.75, forest: 0.66, peaks: 0.8, salt: 4.4,
  sky: ["#1a2838", "#d0a0a8"], ground: [86, 104, 70], canopy: "#245c34", trunk: "#3a2818", waterFill: "#14586e", snow: false,
}, [
  { theater: "Inland Sea", line: "A landing with cedar above and a volcanic ridge behind.", brief: "Helion comes off the water. The sea stays at your back. Do not build on the wet sand.", hudson: "The beach is held. The cedar shelf is the next step up.", video: "japan" },
  { theater: "Cedar Shelf", line: "A tree shelf cut into the coast.", brief: "The shelf is narrow. Infantry in the cedar, tanks on the one flat pad.", hudson: "The shelf is ours. Their air is already off the sea.", video: "japan-02" },
  { theater: "Low Air", line: "Aircraft coming in under the cloud.", brief: "Keep a lance on the pad. Do not line the tanks along the coast road.", hudson: "The air is gone. The volcanic cut is the only road inland.", video: "japan-03" },
  { theater: "Volcanic Cut", line: "Black rock and one climbing road.", brief: "One road through the rock. Walk it. A column that rushes the cut dies in it.", hudson: "The cut is open. The sea glass is in the ridge.", video: "japan-04" },
  { theater: "Sea Glass", line: "The spire looking back at the landing.", brief: "This spire ends the inland sea. Break it and the coast is Helion.", hudson: "The inland sea is closed. Hudson is done with this coast.", video: "japan-05" },
]);

const uk = arc("uk", {
  country: "United Kingdom",
  water: "coast", waterAmt: 0.5, forest: 0.3, peaks: 0.25, salt: 1.2,
  sky: ["#2a3340", "#9aa6b0"], ground: [96, 108, 78], canopy: "#3e6244", trunk: "#3c3024", waterFill: "#3a5a68", snow: false,
}, [
  { theater: "Grey Moor", line: "Low cloud, wet moor, and a short horizon.", brief: "The moor is open and the cloud is down. Ionite is in the peat, not on a ridge.", hudson: "The moor is held. The grey cut of water is on the flank.", video: "uk" },
  { theater: "Grey Cut", line: "A narrow channel beside the moor.", brief: "Keep the channel on your flank. Do not try to fight in it.", hudson: "The cut is secured. The next ground is a pad with no trees.", video: "uk-02" },
  { theater: "Moor Pad", line: "A bare pad in the peat.", brief: "Build walls before you park anything. The moor gives you nothing to hide behind.", hudson: "The pad is up. A short lane runs to the last rise.", video: "uk-03" },
  { theater: "Short Lane", line: "A brief push under the cloud.", brief: "The lane is short. Do not bunch. Their last guns sit at the end of it.", hudson: "The lane is open. The low spire is in the mist.", video: "uk-04" },
  { theater: "Low Spire", line: "A short glass tower in the peat.", brief: "The spire is close and low. Crack it and the moor is finished.", hudson: "The grey moor is closed. Hudson has nothing left in this weather.", video: "uk-05" },
]);

const india = arc("india", {
  country: "India",
  water: "river", waterAmt: 0.8, forest: 0.48, peaks: 0.4, salt: 7.7,
  sky: ["#243028", "#e0c080"], ground: [140, 120, 64], canopy: "#4a7a32", trunk: "#5a3c24", waterFill: "#1a7068", snow: false,
}, [
  { theater: "Deccan Shelf", line: "A monsoon river under a hard plateau.", brief: "The river is up. The plateau is the only clean ground for a base. Stay off the flood.", hudson: "The shelf is held. The monsoon road is the next dry line.", video: "india" },
  { theater: "Monsoon Road", line: "A road that stays above the flood.", brief: "Stay on the road. The fields on either side are water by afternoon.", hudson: "The road is ours. Scrub below the shelf is next, and it is not armor country.", video: "india-02" },
  { theater: "Scrub Line", line: "Infantry in the low scrub.", brief: "Send infantry through the scrub. Tanks stay on the shelf and wait.", hudson: "The scrub is clear. Their guns are back up on the shelf.", video: "india-03" },
  { theater: "Gun Shelf", line: "A gun line on the high ground.", brief: "Take the gun shelf before the last rise. A push under it does not arrive.", hudson: "The guns are quiet. One rise left, and the spire is past it.", video: "india-04" },
  { theater: "Last Rise", line: "The spire past the final rise.", brief: "The Deccan spire is past this rise. Break it and the monsoon front ends.", hudson: "The Deccan is closed. Hudson is done with the flood.", video: "india-05" },
]);

const france = arc("france", {
  country: "France",
  water: "river", waterAmt: 0.6, forest: 0.55, peaks: 0.5, salt: 9.1,
  sky: ["#1e3044", "#b7c4c8"], ground: [100, 112, 70], canopy: "#2f6840", trunk: "#3e2c1e", waterFill: "#1a6074", snow: false,
}, [
  { theater: "Atlantic Cut", line: "An estuary, hedgerows, and a stone ridge.", brief: "The estuary is in flood. Helion builds on the hedgerow shelf, not in the mud.", hudson: "The shelf is held. The hedgerow is the next wall, and it hides both sides.", video: "france" },
  { theater: "Hedgerow", line: "Trees grown into walls.", brief: "Fight the gaps, not the hedges. Infantry clears a gap before a tank tries it.", hudson: "The hedges are ours. The estuary is still high on the left.", video: "france-02" },
  { theater: "Estuary", line: "Flooded ground beside the hedges.", brief: "Do not fight in the flood. Use the hedge line as the road and keep the water on one side.", hudson: "The water is held off. The stone road climbs from here.", video: "france-03" },
  { theater: "Stone Road", line: "A ridge road of cut stone.", brief: "The stone road is the only climb. Do not leave it for the slope.", hudson: "The road is open. The crown glass is on the stone.", video: "france-04" },
  { theater: "Crown Glass", line: "The spire on the stone ridge.", brief: "This is the last glass on the Atlantic cut. Crack it and the estuary front ends.", hudson: "The Atlantic cut is closed. Hudson is done with the hedges.", video: "france-05" },
]);

const brazil = arc("brazil", {
  country: "Brazil",
  water: "river", waterAmt: 0.9, forest: 0.86, peaks: 0.3, salt: 10.5,
  sky: ["#102018", "#6a9870"], ground: [62, 92, 48], canopy: "#145028", trunk: "#2e2014", waterFill: "#0e5048", snow: false,
}, [
  { theater: "Green Margin", line: "Heavy canopy, a dark river, and almost no open ground.", brief: "The canopy hides both sides. The river is the only clean line. Do not wander off it.", hudson: "The river line is held. Cut a lane before you bring tanks in.", video: "brazil" },
  { theater: "First Lane", line: "A cut through the canopy.", brief: "Infantry cuts the lane. Tanks do not enter until the trunks on both sides are quiet.", hudson: "The lane is cut. The water goes dark just ahead.", video: "brazil-02" },
  { theater: "Dark Water", line: "The river under a closed canopy.", brief: "The river is the map here. Stay on the bank you hold. Crossing blind is a loss.", hudson: "The near bank is ours. Their yard is under the canopy, not on the water.", video: "brazil-03" },
  { theater: "Canopy Yard", line: "A yard that never sees the sky.", brief: "Infantry can live in this yard. Armor cannot. Clear it on foot.", hudson: "The yard is taken. The last scar in the trees is the spire.", video: "brazil-04" },
  { theater: "Green Scar", line: "The spire in a tear in the canopy.", brief: "The scar is the only open light. The spire stands in it. Break the glass and the margin closes.", hudson: "The green margin is closed. Hudson has no path left under this canopy.", video: "brazil-05" },
]);

const australiaCoast = arc("australia", {
  country: "Australia",
  water: "coast", waterAmt: 0.72, forest: 0.46, peaks: 0.28, salt: 12.4,
  sky: ["#1d3344", "#d7b56a"], ground: [150, 118, 72], canopy: "#6a7040", trunk: "#6a4a30", waterFill: "#1a6880", snow: false,
}, [
  { theater: "Port Melbourne", line: "The Yarra docks after the interior.", brief: "The red interior is behind you. Melbourne is a dock fight. Hold the river road and take the port sheds.", hudson: "The sheds are ours. Hudson says the next harbour is Sydney, and it is a bridge, not a dock.", video: "australia-melbourne" },
  { theater: "Harbour Bridge", line: "One bridge over Sydney water.", brief: "Sydney is the bridge. Do not split the column. The north shore guns watch the span.", hudson: "The bridge is held. The long coast north is Queensland, and it is not this harbour.", video: "australia-sydney" },
  { theater: "Reef Road", line: "A coast road with the reef on one side.", brief: "Queensland is a road, not a port. The range guns look down on the cargo. Break them before the ships stop.", hudson: "The reef road is held. This coast is closed.", video: "australia-queensland" },
]);

export const COUNTRIES: { id: string; chapters: Chapter[] }[] = [
  { id: "usa", chapters: usa },
  { id: "russia", chapters: russia },
  { id: "china", chapters: china },
  { id: "australia", chapters: [...australia, ...australiaCoast.map((chapter, i) => ({ ...chapter, index: australia.length + i + 1, id: `australia-${String(australia.length + i + 1).padStart(2, "0")}` }))] },
  { id: "korea", chapters: korea },
  { id: "japan", chapters: japan },
  { id: "uk", chapters: uk },
  { id: "india", chapters: india },
  { id: "france", chapters: france },
  { id: "brazil", chapters: brazil },
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
