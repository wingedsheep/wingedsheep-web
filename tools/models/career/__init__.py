"""The career trail's dioramas: one small floating scene per chapter, each exported as
public/models/career-<id>.glb and shown when you click a cairn on the mountain.

To add a chapter: write career/<id>.py with a build() (career/base.py has the floating land,
people, bikes and lettering), list it in SCENES, and give the chapter `scene: '<id>'` in
src/data/career.ts. What its things say when clicked lives in src/data/career.ts too.
"""
from career import backbone, student

SCENES = {
    "student": student.build,
    "backbone": backbone.build,
}
