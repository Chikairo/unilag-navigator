export type Coordinate = [latitude: number, longitude: number];

export type CampusPlace = {
  id: string;
  name: string;
  category: string;
  coordinates: Coordinate;
  aliases: string[];
  osmType: "node" | "way" | "relation";
  osmId: number;
};

export const CAMPUS_CENTER: Coordinate = [6.5120272, 3.3935314];
export const CAMPUS_BOUNDS = {
  south: 6.5016962,
  west: 3.3837495,
  north: 6.522325,
  east: 3.4045333,
};

export const CAMPUS_PLACES: CampusPlace[] = [
  {
    id: "unilag-campus",
    name: "University of Lagos",
    category: "Campus landmark",
    coordinates: CAMPUS_CENTER,
    aliases: ["unilag", "campus", "unilag campus", "campus centre", "campus center"],
    osmType: "way",
    osmId: 539288366,
  },
  {
    id: "medical-centre",
    name: "UNILAG Medical Centre",
    category: "Healthcare",
    coordinates: [6.5144511, 3.3965881],
    aliases: ["medical centre", "clinic", "health centre", "hospital"],
    osmType: "way",
    osmId: 707234131,
  },
  {
    id: "new-hall",
    name: "UNILAG New Hall",
    category: "Student residence",
    coordinates: [6.5199307, 3.3925708],
    aliases: ["new hall", "female hostel", "new hostel"],
    osmType: "way",
    osmId: 572205098,
  },
  {
    id: "eni-njoku-hall",
    name: "Eni Njoku Hall",
    category: "Student residence",
    coordinates: [6.5192161, 3.393527],
    aliases: ["eni njoku", "eni njoku hostel", "eni njoku residence"],
    osmType: "way",
    osmId: 596634676,
  },
  {
    id: "unilag-cafeteria",
    name: "UNILAG Cafeteria",
    category: "Food",
    coordinates: [6.5195537, 3.3916887],
    aliases: ["cafeteria", "caf", "canteen", "food"],
    osmType: "relation",
    osmId: 17630715,
  },
  {
    id: "unilag-pharmacy",
    name: "UNILAG Pharmacy",
    category: "Healthcare",
    coordinates: [6.5185671, 3.3944833],
    aliases: ["pharmacy", "chemist", "drug store"],
    osmType: "way",
    osmId: 1235638534,
  },
  {
    id: "shuttle-bus-station",
    name: "UNILAG Shuttle Bus Station",
    category: "Transport",
    coordinates: [6.5183455, 3.3948892],
    aliases: ["bus station", "shuttle", "bus stop", "transport"],
    osmType: "way",
    osmId: 707240101,
  },
  {
    id: "islamic-centre",
    name: "UNILAG Islamic Centre",
    category: "Campus landmark",
    coordinates: [6.5189629, 3.3903439],
    aliases: ["islamic center", "islamic centre", "mosque"],
    osmType: "way",
    osmId: 1286088886,
  },
  {
    id: "staff-school",
    name: "UNILAG Staff School",
    category: "School",
    coordinates: [6.5158025, 3.3968489],
    aliases: ["staff school", "school"],
    osmType: "way",
    osmId: 707225702,
  },
  {
    id: "faculty-of-art",
    name: "Faculty of Arts",
    category: "Faculty",
    coordinates: [6.5181083, 3.3980033],
    aliases: ["art", "arts", "faculty of art", "foa"],
    osmType: "way",
    osmId: 1424381710,
  },
  {
    id: "faculty-engineering",
    name: "Faculty of Engineering",
    category: "Faculty",
    coordinates: [6.5177976, 3.3996475],
    aliases: ["engineering", "engineer", "eng", "foe", "faculty of eng"],
    osmType: "node",
    osmId: 6121119459,
  },
  {
    id: "faculty-science",
    name: "Faculty of Science",
    category: "Faculty",
    coordinates: [6.5152482, 3.3993715],
    aliases: ["science", "sci", "fos", "faculty of sci"],
    osmType: "node",
    osmId: 6121748261,
  },
  {
    id: "faculty-management-sciences",
    name: "Faculty of Management Sciences",
    category: "Faculty",
    coordinates: [6.5206861, 3.3995784],
    aliases: ["management sciences", "fms", "management faculty"],
    osmType: "node",
    osmId: 6122566947,
  },
  {
    id: "faculty-law",
    name: "Faculty of Law",
    category: "Faculty",
    coordinates: [6.5205218, 3.3989719],
    aliases: ["law", "fol", "faculty law"],
    osmType: "node",
    osmId: 6122566946,
  },
  {
    id: "king-jaja-hall",
    name: "King Jaja Hall",
    category: "Student residence",
    coordinates: [6.5162371, 3.3980373],
    aliases: ["king jaja", "jaja hall", "jaja hostel"],
    osmType: "node",
    osmId: 6121178177,
  },
  {
    id: "mariere-hall",
    name: "Mariere Hall",
    category: "Student residence",
    coordinates: [6.5180142, 3.3980559],
    aliases: ["mariere", "mariere hostel"],
    osmType: "node",
    osmId: 6121187825,
  },
  {
    id: "main-library",
    name: "UNILAG Main Library",
    category: "Library",
    coordinates: [6.5201116, 3.3998117],
    aliases: ["library", "main library", "unilag library"],
    osmType: "node",
    osmId: 6122566943,
  },
  {
    id: "ecobank",
    name: "EcoBank, UNILAG Branch",
    category: "Banking",
    coordinates: [6.5186599, 3.3972973],
    aliases: ["ecobank", "eco bank", "bank", "atm"],
    osmType: "node",
    osmId: 13024020870,
  },
];

export function isInsideCampus([latitude, longitude]: Coordinate): boolean {
  return (
    latitude >= CAMPUS_BOUNDS.south &&
    latitude <= CAMPUS_BOUNDS.north &&
    longitude >= CAMPUS_BOUNDS.west &&
    longitude <= CAMPUS_BOUNDS.east
  );
}
