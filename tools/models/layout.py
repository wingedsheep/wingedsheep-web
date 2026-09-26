"""Island layout in metres. x = east, y = north, z = up. The default camera looks north."""

# terrain extent (the sea continues forever in the runtime)
EXTENT = (-44.0, -32.0, 44.0, 32.0)   # min x, min y, max x, max y
CELL = 0.5                            # terrain grid resolution

# Island body: union of ellipses (cx, cy, rx, ry)
ISLAND = [
    (0, -2, 30, 16),      # main body
    (-22, -3, 12, 6.5),   # west peninsula
    (-31, -3, 6, 5),      # lighthouse point
    (18, -12, 13, 8),     # south-east cove
    (2, 11, 23, 12),      # mountain base
    (24, 2, 12, 11),      # eastern forest
    (-15, -12, 11, 6),    # south-west meadow
]

# Terraces: (ellipses, height of the top surface)
PLATEAUS = [
    ([(2, 13, 18, 6.5), (-9, 10, 7, 3.5), (15, 11, 8, 4), (7, 16, 14, 5)], 3.2),
    ([(4, 16, 11, 3.8), (-2, 15, 4.5, 2.2), (13, 16.4, 5.5, 3.0)], 6.4),   # east lobe: the hut
    ([(-31.5, -3, 4.2, 3.0)], 1.9),   # lighthouse rock
]

# Points of interest (x, y); the runtime reads final positions from the exported scene
PLAZA = (0, -8)
DOCK = (0, -17.5)                 # where the pier leaves the beach
DOCK_LEN = 11.0
LIBRARY = (-11, -4.5)
WORKSHOP = (11.5, -4.5)
CARD_TABLE = (WORKSHOP[0] - 5.2, WORKSHOP[1] - 4.6)
LIGHTHOUSE = (-31.5, -3)
CAMPFIRE = (27, -1)
WELL = (20, -14)
BENCH = (-17, -11)
READING = (22.9, -14.0)            # a picnic blanket under the blossom tree, by the well
WORKOUT = (-4.4, -12.6)            # her exercise mat, on the grass above the beach west of the pier
PIER_SEAT = (-1.0, -21.5)          # her, with a podcast: on the pier's west edge between two posts, legs over the water
# Vincent with a podcast: pacing up and down the path from the plaza towards the well
PODCAST_WALK = [(3.0, -10.3), (8.0, -12.0), (12.5, -13.1), (17.2, -13.9)]
BEIKE = (-12.5, -12.5)             # Beike's spot in the meadow; he fetches the ball around it
PETTING = (-12.8, -11.9)           # kneeling in his meadow while he lies in front of them, facing the camera
SIGNPOST = (-2.6, -15.5)
BOULDER = (19, 6)
SETT = (28.6, -4.3)                # the badgers’ sett, where the eastern woods meet the beach
SUMMIT = (5.0, 18.6)
# The peak rises from the upper terrace: centre, radius, height of the top ledge
PEAK = ((5.0, 18.6), 6.0, 13.5)
KAYAK = (2.6, -24)
KAYAK_LOOP = ((9.0, -27.0), 6.0, 3.5)  # where Vincent paddles about: the middle, and the radii east-west and north-south
YOGA = (9.0, -14.2)                # his yoga mat on the grass above the beach east of the pier; hers is just east of it
# Up the mountain: from the foot of the trail at the plaza, up the stairs and the switchbacks to
# the summit flag (and back down the same way)
CLIMB = [(0.0, -4.0), (0.5, -1.0), (-2.0, 2.5), (-5.0, 5.0), (-6.5, 6.2), (-6.5, 8.2), (0.0, 10.4), (6.0, 11.2),
         (10.5, 11.6), (10.5, 14.2), (8.0, 13.6), (5.0, 13.4), (8.2, 14.7), (2.6, 16.0), (7.0, 17.3), (5.6, 18.0)]

# Out of the rain (src/island/scene/shelter.ts): each route runs from where they doze to just
# inside a door. Charlie and George, and Beike, go home to the lighthouse; the dock cat goes all
# the way up the trail to the hut, to sleep on Vincent's bed. "deck" points are on the pier;
# "floor" points are up on the lighthouse's plinth.
SHELTER = {
    "bench": [(-16.8, -11.8), (-19.5, -8.4), (-23.5, -5.8), (-26.2, -4.3), (-28.4, -4.6),
              (-30.3, -4.9), (-31.5, -4.5, "floor"), (-31.5, -3.4, "floor")],
    "beike": [(-14.8, -9.8), (-19.5, -8.4), (-23.5, -5.8), (-26.2, -4.3), (-28.4, -4.6),
              (-30.3, -4.9), (-31.5, -4.5, "floor"), (-31.5, -3.4, "floor")],
    "dock": [(0.4, -25.4, "deck"), (0.2, -18.4, "deck"), (0.0, -15.6), (0.0, -4.0), (0.5, -1.0),
             (-2.0, 2.5), (-5.0, 5.0), (-6.5, 6.2), (-6.5, 8.2), (0.0, 10.4), (6.0, 11.2), (10.5, 11.6),
             (10.5, 14.2), (13.2, 14.4), (14.2, 14.7), (14.2, 15.9)],
}

# Paths: polylines with a width in metres
PATHS = [
    ([(0, -17.5), (0, -12.5)], 1.6),                                  # dock -> plaza
    ([(-4, -7.5), (-8, -7), (-11, -7.2)], 1.4),                       # plaza -> library
    ([(4, -7.5), (8, -7), (11.5, -7.2)], 1.4),                        # plaza -> workshop
    ([(3.6, -9.5), (9, -11), (15, -10.5), (21, -6), (25, -2.5)], 1.2),  # -> campfire
    ([(-14, -7.5), (-20, -5.5), (-26, -4)], 1.2),                     # library -> lighthouse
    ([(4, -10), (12, -13), (18.5, -14)], 1.0),                        # -> well
    ([(-18.2, -11.5), (-16.0, -10.8)], 1.8),                          # bare under the bench, round its flagstones
]
# The trail up the mountain: stepped ramps (x, y_bottom, y_top) cut through each rise
STAIRS = [(-6.5, 4.6, 8.0), (10.5, 10.4, 14.0)]
# The mountain trail, from the plaza up: pale gravel with stone edges, so it doesn't read as
# just another path (terrain.py)
TRAIL = [
    ([(0, -4), (0.5, -1), (-2, 2.5), (-5, 5), (-6.5, 6.2)], 1.6),      # plaza -> trail foot
    ([(-6.5, 8.2), (0, 10.4), (6, 11.2), (10.5, 11.6)], 1.6),
    ([(10.5, 14.2), (8, 13.6), (5.0, 13.4)], 1.5),
    ([(10.5, 14.2), (13.2, 14.4)], 1.2),                                # to the hut's door
]
# ...and then it zigzags up the peak to the summit, cut into the slope as a ledge
SWITCHBACKS = [(5.0, 13.4), (8.2, 14.7), (2.6, 16.0), (7.0, 17.3), (5.2, 18.3)]
HUT = (14.2, 16.4)                # the mountain hut on the upper terrace's east lobe
# one cairn per chapter of the career (src/data/career.ts), from the foot of the trail up,
# each with a token of its stretch on top
CAIRNS = [(-0.2, 1.9), (2.4, 11.4), (8.8, 15.8)]
CAIRN_EMBLEMS = {0: "mortarboard", 1: "bus", 2: "bolt"}
