"""Colour palette (hue-shifted, cosy). Values are sRGB hex; kit.material() converts to linear."""

# terrain
SAND_WET = "#a88457"
SAND = "#dcbd83"
SAND_LIGHT = "#ecd29d"
GRASS = ["#3f7d43", "#4a8a45", "#5a9a4a", "#6aa74f", "#7fb857"]
GRASS_HIGH = ["#5a9a4a", "#6aa74f", "#86bd5a", "#9ccc66"]
DIRT = "#a3713f"
DIRT_LIGHT = "#c28a55"
ROCK = ["#4a3f52", "#5d5063", "#6f6273", "#857584"]
PEBBLE = "#8c7f86"
SNOW = "#e9f0f7"
COBBLE = ["#7d7483", "#8f8795", "#a09aa2"]
GOLD = "#e8b24a"

# foliage
LEAF = ["#234d35", "#2f6a3c", "#3f8043", "#5a9a4a"]
PINE = ["#1b3e36", "#234d3d", "#2d5a44"]
AUTUMN = ["#a84726", "#c85a2c", "#e0823a"]
BLOSSOM = ["#d98fb0", "#ecb3c8", "#f6d2df"]
BARK = "#50332b"

# building materials
PLASTER = "#e6d4b8"
PLASTER_DARK = "#c9b394"
STONE = "#8f8799"
STONE_DARK = "#6a6275"
PLUM_ROOF = "#6a3b6e"
PLUM_ROOF_DARK = "#4e2a55"
RUST_ROOF = "#b0512f"
WOOD = "#8a5a36"
WOOD_DARK = "#5c3824"
WOOD_LIGHT = "#b27a48"
PLANK = "#9a6a3f"
IRON = "#2e2a3a"
WHITE = "#f2ece2"
RED = "#c8403a"
INK = "#1d1a24"
BOOKS = ["#8c2f39", "#2f5d8c", "#c9a23f", "#3d7a4a", "#6b3f8c", "#b5562d"]

# glow (emissive; the runtime scales these at night)
WARM_LIGHT = "#ffc46b"
SCREEN = "#6fe0d6"
LANTERN = "#fff1b0"
FIRE = "#ff9a3c"
UFO = "#b8f5e8"

# characters
SKIN = "#e3a680"          # Vincent: sun-tanned
HAIR = "#5a3e2c"
BEARD = "#7a5a44"
BEARD_GREY = "#9c8f82"
CAP = "#4d5d8a"           # dusty blue cap, worn backwards
CAP_DARK = "#35426a"
TEE = "#26242b"           # black v-neck
SHORTS = "#2f3a63"
SHOE = "#3b3a42"
SOLE = "#d9d3c7"
TEETH = "#f6efe4"
SHADES = "#2b2830"
SHADES_FRAME = "#b5562d"
WATCH = "#1b1b20"
# his dreadnought: spruce top, dark sides, rosewood board
GUITAR = "#e2b46a"
GUITAR_SIDES = "#4f2e1d"
GUITAR_NECK = "#7a4a2a"
FRETBOARD = "#2e1d18"
PICKGUARD = "#3a2218"
STRING = "#e8e2d4"
TUNER = "#c9c6c0"
WOOL = "#f4f2ee"
SHEEP_FACE = "#2a2433"
FEATHER = "#f3e2bd"
CAT = "#1f1c26"
KAYAK = "#e0602a"
# Charlie & George: white cats with ginger patches, asleep on a dark teal fleece
CAT_WHITE = "#f5efe4"
GINGER = "#d9884a"
GINGER_DARK = "#b86a35"
CAT_NOSE = "#e39a9a"
EAR_PINK = "#eab3a8"
FLEECE = "#1f4f5a"
FLEECE_DARK = "#173c46"

# the library, inside: bottle-green walls, walnut shelves, a red rug, a black upright piano
WALLPAPER = "#2f4f47"
WALLPAPER_STRIPE = "#365a50"
WALL_CUT = "#231e2b"          # the sawn-off top of the dollhouse walls
WALNUT = "#4a2c1e"
WALNUT_BACK = "#2e1b14"
RUG = "#7a2c3a"
RUG_DARK = "#5e2230"
PIANO = "#241820"
PIANO_EDGE = "#3a2a33"
KEYS = "#f3ecdc"
LEATHER = "#8c3a2a"
LEATHER_DARK = "#6a2a20"
LAMP_GREEN = "#2f6a4a"
FIREBOX = "#1a1216"
SKY_DAY = "#a9dcff"           # window glass; the runtime recolours it with the time of day
