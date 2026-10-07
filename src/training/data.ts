// Plan content ported verbatim from reference/prototype.html.
import type { Exercise } from "./types";

export interface Phase { from: number; to: number; name: string; note: string }
export const phases: Phase[] = [
  {from:1,to:13,name:"Foundation",note:"Easy cardio and simple strength. Build the habit."},
  {from:14,to:26,name:"Build the engine",note:"Longer rides, first walk/run intervals, harder strength moves."},
  {from:27,to:39,name:"Become a runner",note:"Walk/run three days a week, bike on the easy days."},
  {from:40,to:52,name:"Race prep",note:"Long walk/runs build to 11 miles, strength stays short. Then rest up."}
];
export const intervals: string[] = ["jog 1 min, walk 2 min, 7 rounds","jog 1 min, walk 2 min, 7 rounds","jog 1.5 min, walk 2 min, 6 rounds","jog 2 min, walk 2 min, 6 rounds","jog 2 min, walk 2 min, 6 rounds","jog 3 min, walk 2 min, 5 rounds","jog 3 min, walk 2 min, 5 rounds","jog 4 min, walk 2 min, 4 rounds","jog 4 min, walk 1.5 min, 5 rounds","jog 5 min, walk 2 min, 4 rounds","jog 6 min, walk 2 min, 4 rounds","jog 8 min, walk 2 min, 3 rounds","jog 10 min, walk 2 min, 3 rounds"];
export const long3: number[] = [3,3,3.5,4,3,4,4.5,5,4,5,5.5,6,5];
export const long4: number[] = [6,7,7.5,6,8,8.5,9,7,10,11,8,6];
export const MILE_TESTS: number[] = [14,27,40,49];
export const milestones: Record<number, string> = {
  1:"This week: decide what time of day you'll train, and keep it the same.",
  19:"Optional: walk/run the Virgin River 5K on Sat Feb 13 just to see a finish line.",
  26:"This week: register for the St. George Half (opened April 1 in past years).",
  35:"From now on, do cardio early in the morning before the heat.",
  44:"Friday's long walk/run: test your race-day shoes, clothes and fuel."
};

export interface GearItem { k: string; name: string; wk: number; need: boolean; cost: string; why: string; mp?: boolean }
export const GEAR: GearItem[] = [
  {k:"helmet",name:"Bike helmet",wk:1,need:true,cost:"$20 to $40",why:"Non-negotiable for road riding. Buy new or barely used, never one that's been in a crash."},
  {k:"tuneup",name:"Bike tune-up",wk:1,need:true,cost:"$0 to $60",why:"Air in the tires, oil the chain, set seat height so your knee is almost straight at the bottom. Wrong seat height is a top cause of knee pain."},
  {k:"bottle",name:"Water bottle",wk:1,need:true,cost:"$0 to $10",why:"St. George is dry. Drink before, during and after."},
  {k:"lights",name:"Bike lights, front and rear",wk:3,need:true,cost:"$15 to $25",why:"Winter mornings and evenings are dark."},
  {k:"fitband",name:"Galaxy Fit3 heart rate band",wk:6,need:false,cost:"about $50",why:"Shows heart rate on your wrist so easy days stay easy. Pairs with Samsung Health. Log your average heart rate with each session."},
  {k:"mat",name:"Exercise mat",wk:2,need:false,cost:"$10 to $20",why:"Makes floor work comfortable. Marketplace is fine.",mp:true},
  {k:"bands",name:"Resistance band set with door anchor",wk:8,need:false,cost:"$15 to $25",why:"Unlocks band rows, pull-aparts and banded bridges. Best value upgrade for your back and hips.",mp:true},
  {k:"shoes",name:"Running shoes, fitted at a running store",wk:12,need:true,cost:"$100 to $150",why:"Required before walk/run starts. Ask for cushioned and stable. Buy new, not used."},
  {k:"socks",name:"Running socks, 2 pairs (not cotton)",wk:12,need:true,cost:"$15 to $25",why:"Wicking socks prevent blisters and keep feet happier."},
  {k:"kettlebell",name:"Kettlebell, 25 to 35 lb",wk:14,need:false,cost:"$25 to $50",why:"Unlocks goblet squats, kettlebell rows and deadlifts. Huge upgrade for leg and back strength. Marketplace is perfect for this.",mp:true},
  {k:"roller",name:"Foam roller",wk:26,need:false,cost:"$10 to $20",why:"Adds calf and quad rolling to your Friday stretch. Helps legs recover as running ramps up.",mp:true},
  {k:"hydration",name:"Handheld bottle or running belt",wk:35,need:true,cost:"$15 to $30",why:"You'll need water on long walk/runs over 6 miles."},
  {k:"glide",name:"Anti-chafe balm",wk:35,need:true,cost:"$8 to $12",why:"Long sessions in heat cause chafing. Use it on thighs and feet."},
  {k:"hat",name:"Running hat and sunglasses",wk:35,need:false,cost:"$15 to $30",why:"Summer sun in Southern Utah is brutal even early."},
  {k:"shoes2",name:"Second pair of running shoes (race pair)",wk:42,need:false,cost:"$100 to $150",why:"Your first pair will be worn down by now. Break the new pair in for 4+ weeks before race day."},
  {k:"fuel",name:"Energy chews or gels",wk:44,need:true,cost:"$10 to $20",why:"For runs over an hour. Test what your stomach likes long before race day."}
];

export const HOW: Record<string, string> = {
  "Chair sit-to-stand":"Sit on the front edge of a sturdy chair, feet flat. Stand up without using your hands, then sit back down slowly. Knees track over your toes.",
  "Bodyweight squat":"Feet shoulder width. Push your hips back like sitting into a chair, chest up, weight in your heels. Go as low as comfortable, then stand.",
  "Slow squat":"A regular squat, but take 3 full seconds to lower down. Stand up at normal speed.",
  "Backpack squat":"Hug a loaded backpack to your chest and squat. Hips back, chest up, heels down.",
  "Goblet squat":"Hold the kettlebell by the horns at your chest, elbows down. Squat between your knees, chest tall, then stand. The weight in front helps you sit back.",
  "Step-up":"Step up onto the bottom stair with one foot, push through that heel to stand tall, step back down. Do all reps on one leg, then switch. Hold the rail for balance.",
  "Reverse lunge":"Stand tall, step one foot back, and lower your back knee toward the floor. Push through the front heel to return. Front knee stays over the ankle.",
  "Split squat":"Stand in a long stride, back heel up. Lower straight down until the back knee nearly touches the floor, then rise. Stay in place for all reps, then switch.",
  "Couch split squat":"Like a split squat, but rest the top of your back foot on the couch. Lower straight down on the front leg. This is hard; go slow.",
  "Glute bridge":"Lie on your back, knees bent, feet flat. Squeeze your butt and lift your hips until your body is a straight line from knees to shoulders. Lower slowly.",
  "Banded glute bridge":"A glute bridge with a loop band just above your knees. Push your knees out against the band the whole time.",
  "Single-leg glute bridge":"Same as a glute bridge, but one foot lifted off the floor. Keep your hips level.",
  "Kettlebell deadlift":"Kettlebell on the floor between your feet. Push your hips back with a flat back, grab the handle, and stand up by squeezing your butt. Lower it the same way. Hips do the work, not your back.",
  "Calf raises":"Stand near a wall for balance. Rise onto your toes as high as you can, pause, lower slowly. Great for knees and running.",
  "Single-leg calf raises":"Calf raise on one foot, hand on the wall for balance. Full range, slow down.",
  "Wall sit":"Back flat against a wall, slide down until your knees are bent (aim toward 90 degrees as you get stronger). Hold.",
  "Counter pushup":"Hands on the kitchen counter, body in a straight line. Lower your chest to the counter, push back up. The more upright, the easier.",
  "Chair pushup":"Hands on the seat of a sturdy chair pushed against a wall, or on the couch. Body straight, chest down, push up.",
  "Knee pushup":"Hands on the floor under your shoulders, knees down. Straight line from knees to head. Lower your chest, push up.",
  "Pushup":"Hands under shoulders, body in a straight plank. Lower your chest close to the floor, elbows angled back, push up. Drop to knees when form breaks.",
  "Backpack row":"Hold a loaded backpack by the top handle. Hinge forward with a flat back, one hand on a table. Pull the bag to your hip, squeezing your shoulder blade back. Lower slowly.",
  "Band row":"Anchor the band in a door at chest height. Step back until it's tight, pull the handles to your ribs, squeezing your shoulder blades together. Return slowly.",
  "Kettlebell row":"One hand on a table, flat back. Pull the kettlebell to your hip, squeezing your shoulder blade back. Lower slowly.",
  "Floor Y-raise":"Lie face down, arms overhead in a Y, thumbs up. Lift your arms and chest a few inches off the floor, pause, lower. Builds the upper back.",
  "Superman hold":"Face down, arms overhead. Lift arms, chest and legs off the floor together and hold. Breathe.",
  "Band pull-apart":"Hold a band in front of your chest, arms straight. Pull it apart until it touches your chest, squeezing your shoulder blades. Return slowly.",
  "Knee plank":"Forearms on the floor, knees down, straight line from knees to head. Squeeze your stomach and hold.",
  "Plank":"Forearms on the floor, up on your toes, body straight like a board. Don't let your hips sag. Hold.",
  "Dead bug":"Lie on your back, arms up, knees bent over hips. Slowly lower the opposite arm and leg toward the floor while keeping your low back pressed down. Return and switch.",
  "Bird dog":"On hands and knees. Reach one arm forward and the opposite leg back until straight, hold 2 seconds, return. Keep your back flat like a table.",
  "Knee side plank":"Lie on your side, forearm under your shoulder, knees bent. Lift your hips so you're straight from knees to head. Hold, then switch sides.",
  "Side plank":"Like a knee side plank, but legs straight and stacked, up on the side of your feet. Hold, then switch.",
  "Foam roll calves and quads":"Sit with the roller under one calf, roll slowly from ankle to knee. Then lie face down with it under your thighs and roll knee to hip. Pause on tight spots.",
  "Hip flexor stretch":"Kneel on one knee, other foot in front. Squeeze your butt and shift forward gently until you feel the front of the back hip stretch.",
  "Hamstring stretch":"Sit with one leg straight, other bent. Reach toward the straight leg's toes with a flat back until you feel the back of the thigh.",
  "Calf stretch":"Hands on a wall, one foot back with the heel down and knee straight. Lean in until the calf stretches.",
  "Figure-four stretch":"Lie on your back, cross one ankle over the other knee, pull the bottom leg toward you. Feel it in the butt and hip.",
  "Child's pose":"Kneel, sit back on your heels, reach your arms forward on the floor and relax your back."
};

// [name, amount, unit, isSeconds] per level (phase)
type ExRow = [string, number, string, 1?];
const EX_ROWS: Record<string, ExRow[]> = {
  squat:[["Chair sit-to-stand",10,""],["Bodyweight squat",12,""],["Slow squat",12,""],["Backpack squat",12,""]],
  step:[["Step-up",8," each leg"],["Reverse lunge",8," each leg"],["Split squat",10," each leg"],["Couch split squat",8," each leg"]],
  bridge:[["Glute bridge",12,""],["Glute bridge",15,""],["Single-leg glute bridge",8," each leg"],["Single-leg glute bridge",12," each leg"]],
  calf:[["Calf raises",15,""],["Calf raises",20,""],["Single-leg calf raises",12," each leg"],["Single-leg calf raises",15," each leg"]],
  wall:[["Wall sit",20,"",1],["Wall sit",30,"",1],["Wall sit",45,"",1],["Wall sit",60,"",1]],
  push:[["Counter pushup",10,""],["Chair pushup",10,""],["Knee pushup",10,""],["Pushup",8,""]],
  row:[["Backpack row",10," each arm"],["Backpack row",12," each arm"],["Backpack row",12," each arm"],["Backpack row",15," each arm"]],
  yraise:[["Floor Y-raise",10,""],["Floor Y-raise",12,""],["Superman hold",20,"",1],["Superman hold",30,"",1]],
  plank:[["Knee plank",20,"",1],["Plank",20,"",1],["Plank",40,"",1],["Plank",60,"",1]],
  deadbug:[["Dead bug",6," each side"],["Dead bug",8," each side"],["Dead bug",10," each side"],["Dead bug",12," each side"]],
  birddog:[["Bird dog",6," each side"],["Bird dog",8," each side"],["Bird dog",10," each side"],["Bird dog",12," each side"]],
  side:[["Knee side plank",15," each side",1],["Side plank",15," each side",1],["Side plank",25," each side",1],["Side plank",35," each side",1]]
};

const STRETCH_ROWS: ExRow[] = [["Hip flexor stretch",30," each side",1],["Hamstring stretch",30," each side",1],["Calf stretch",30," each side",1],["Figure-four stretch",30," each side",1],["Child's pose",45,"",1]];
export interface Routine { name: string; keys: string[]; wed?: boolean; circuit?: boolean }
export const ROUTINES: Routine[] = [
  {name:"Legs",keys:["squat","step","bridge","calf"]},
  {name:"Push and core",keys:["push","plank","deadbug","side"]},
  {name:"Back and hips",keys:["row","yraise","birddog","bridge"],wed:true},
  {name:"Legs and core",keys:["wall","step","calf","side"]},
  {name:"Full body circuit",keys:["squat","push","row","plank"],circuit:true}
];

export interface Goal { k: string; name: string; dist: number; by: number; tiers: number[] }
export const GOALS: Goal[] = [
  {k:"mile",name:"1 mile",dist:1,by:27,tiers:[14*60,12*60+30,11*60]},
  {k:"five",name:"5 miles",dist:5,by:40,tiers:[70*60,62*60+30,57*60+30]},
  {k:"ten",name:"10 miles",dist:10,by:49,tiers:[140*60,128*60,118*60]},
  {k:"half",name:"Half marathon",dist:13.1,by:52,tiers:[180*60,165*60,150*60]}
];

export const toExercise = ([name, amount, unit, sec]: ExRow): Exercise => ({ name, amount, unit, seconds: !!sec });
export const EX: Record<string, Exercise[]> = Object.fromEntries(
  Object.entries(EX_ROWS).map(([k, rows]) => [k, rows.map(toExercise)]),
);
export const STRETCH: Exercise[] = STRETCH_ROWS.map(toExercise);
