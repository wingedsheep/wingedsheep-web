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
    ([(4, 16, 11, 3.8), (-2, 15, 4.5, 2.2), (11, 17, 5, 2.4)], 6.4),
    ([(-31.5, -3, 4.2, 3.0)], 1.9),   # lighthouse rock
]

# Points of interest (x, y); the runtime reads final positions from the exported scene
PLAZA = (0, -8)
DOCK = (0, -17.5)                 # where the pier leaves the beach
DOCK_LEN = 11.0
LIBRARY = (-11, -4.5)
WORKSHOP = (11.5, -4.5)
LIGHTHOUSE = (-31.5, -3)
CAMPFIRE = (27, -1)
WELL = (20, -14)
BENCH = (-17, -11)
SIGNPOST = (-2.6, -15.5)
BOULDER = (19, 6)
SUMMIT = (5.0, 18.6)
# The peak rises from the upper terrace: centre, radius, height of the top ledge
PEAK = ((5.0, 18.6), 6.0, 13.5)
KAYAK = (2.6, -24)

# Paths: polylines with a width in metres
PATHS = [
    ([(0, -17.5), (0, -12.5)], 1.6),                                  # dock -> plaza
    ([(-4, -7.5), (-8, -7), (-11, -7.2)], 1.4),                       # plaza -> library
    ([(4, -7.5), (8, -7), (11.5, -7.2)], 1.4),                        # plaza -> workshop
    ([(3.6, -9.5), (9, -11), (15, -10.5), (21, -6), (25, -2.5)], 1.2),  # -> campfire
    ([(-14, -7.5), (-20, -5.5), (-26, -4)], 1.2),                     # library -> lighthouse
    ([(0, -4), (0.5, -1), (-2, 2.5), (-5, 5)], 1.2),                  # plaza -> trail foot
    ([(4, -10), (12, -13), (18.5, -14)], 1.0),                        # -> well
]
# The trail up the mountain: stepped ramps (x, y_bottom, y_top) cut through each rise
STAIRS = [(-6.5, 4.6, 8.0), (10.5, 10.4, 14.0), (5.0, 13.6, 18.0)]
TRAIL = [
    ([(-5, 5), (-6.5, 6.2)], 1.0),
    ([(-6.5, 8.2), (0, 10.4), (6, 11.2), (10.5, 11.6)], 1.0),
    ([(10.5, 14.2), (8, 13.6), (5.0, 13.4)], 0.9),
]
CAIRNS = [(-3.5, 3.6), (-4.6, 9.0), (2.4, 11.4), (8.2, 12.3), (8.8, 15.8), (4.0, 18.6)]
