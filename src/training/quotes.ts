// Quote of the week: one per plan week. Mostly athletes and coaches, plus a few humorists; attributions are well documented.
// Ordered to fit the plan: easy-start and cycling quotes in Foundation, grit for mile tests, Kipchoge on race week.

export interface Quote { text: string; by: string }

export const QUOTES: Quote[] = [
  { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", by: "John Bingham, marathoner" },
  { text: "When I first started running, I was so embarrassed I'd walk when cars passed me. I'd pretend I was looking at the flowers.", by: "Joan Benoit Samuelson, Olympic marathon champion" },
  { text: "If you have a body, you are an athlete.", by: "Bill Bowerman, track coach" },
  { text: "Ride as much or as little, or as long or as short as you feel. But ride.", by: "Eddy Merckx, cyclist" },
  { text: "Don't let what you cannot do interfere with what you can do.", by: "John Wooden, basketball coach" },
  { text: "Hard work beats talent when talent doesn't work hard.", by: "Tim Notke, basketball coach" },
  { text: "Ride your bike, ride your bike, ride your bike.", by: "Fausto Coppi, cyclist" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", by: "Jim Ryun, miler" },
  { text: "If you run, you are a runner. It doesn't matter how fast or how far.", by: "John Bingham, marathoner" },
  { text: "It never gets easier, you just go faster.", by: "Greg LeMond, cyclist" },
  { text: "Get a bicycle. You will not regret it, if you live.", by: "Mark Twain" },
  { text: "Run when you can, walk if you have to, crawl if you must; just never give up.", by: "Dean Karnazes, ultramarathoner" },
  { text: "You miss 100% of the shots you don't take.", by: "Wayne Gretzky, hockey player" },
  { text: "To give anything less than your best is to sacrifice the gift.", by: "Steve Prefontaine, distance runner" },
  { text: "Shut up, legs!", by: "Jens Voigt, cyclist" },
  { text: "The triumph can't be had without the struggle.", by: "Wilma Rudolph, Olympic sprinter" },
  { text: "It's hard to beat a person who never gives up.", by: "Babe Ruth, baseball player" },
  { text: "Start where you are. Use what you have. Do what you can.", by: "Arthur Ashe, tennis player" },
  { text: "Don't look back. Something might be gaining on you.", by: "Satchel Paige, baseball pitcher" },
  { text: "It's not the load that breaks you down, it's the way you carry it.", by: "Lou Holtz, football coach" },
  { text: "I trained four years to run nine seconds and people give up when they don't see results in two months.", by: "Usain Bolt, sprinter" },
  { text: "I am building a fire, and every day I train, I add more fuel. At just the right moment, I light the match.", by: "Mia Hamm, soccer player" },
  { text: "The difference between a successful person and others is not a lack of strength, not a lack of knowledge, but rather a lack of will.", by: "Vince Lombardi, football coach" },
  { text: "Baseball is ninety percent mental and the other half is physical.", by: "Yogi Berra, baseball player" },
  { text: "If you are losing faith in human nature, go out and watch a marathon.", by: "Kathrine Switzer, marathoner" },
  { text: "Don't dream of winning, train for it.", by: "Mo Farah, distance runner" },
  { text: "The man who can drive himself further once the effort gets painful is the man who will win.", by: "Roger Bannister, first sub-four-minute mile" },
  { text: "Only the disciplined ones in life are free. If you are undisciplined, you are a slave to your moods and your passions.", by: "Eliud Kipchoge, marathoner" },
  { text: "I really think a champion is defined not by their wins but by how they can recover when they fall.", by: "Serena Williams, tennis player" },
  { text: "I've failed over and over and over again in my life. And that is why I succeed.", by: "Michael Jordan, basketball player" },
  { text: "I'd rather regret the risks that didn't work out than the chances I didn't take at all.", by: "Simone Biles, gymnast" },
  { text: "We all have dreams. But in order to make dreams come into reality, it takes an awful lot of determination, dedication, self-discipline, and effort.", by: "Jesse Owens, Olympic sprinter" },
  { text: "When anyone tells me I can't do anything, I'm just not listening any more.", by: "Florence Griffith Joyner, sprinter" },
  { text: "Ask yourself: can I give more? The answer is usually yes.", by: "Paul Tergat, marathoner" },
  { text: "Pressure is a privilege.", by: "Billie Jean King, tennis player" },
  { text: "I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion.", by: "Muhammad Ali, boxer" },
  { text: "Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love of what you are doing.", by: "Pelé, soccer player" },
  { text: "Out on the roads there is fitness and self-discovery and the persons we were destined to be.", by: "George Sheehan, runner and cardiologist" },
  { text: "It is not the mountain we conquer but ourselves.", by: "Edmund Hillary, mountaineer" },
  { text: "A lot of people run a race to see who is fastest. I run to see who has the most guts.", by: "Steve Prefontaine, distance runner" },
  { text: "Everything negative, pressure, challenges, is all an opportunity for me to rise.", by: "Kobe Bryant, basketball player" },
  { text: "It is better to look ahead and prepare than to look back and regret.", by: "Jackie Joyner-Kersee, heptathlete" },
  { text: "The battles that count aren't the ones for gold medals. The struggles within yourself, the invisible inevitable battles inside all of us, that's where it's at.", by: "Jesse Owens, Olympic sprinter" },
  { text: "Jogging is very beneficial. It's good for your legs and your feet. It's also very good for the ground. It makes it feel needed.", by: "Jack Handey, comedy writer" },
  { text: "If you want to run, run a mile. If you want to experience a different life, run a marathon.", by: "Emil Zátopek, distance runner" },
  { text: "Never, ever give up.", by: "Diana Nyad, distance swimmer" },
  { text: "The real purpose of running isn't to win a race, it's to test the limits of the human heart.", by: "Bill Bowerman, track coach" },
  { text: "The will to win is nothing without the will to prepare.", by: "Juma Ikangaa, marathoner" },
  { text: "It ain't over till it's over.", by: "Yogi Berra, baseball player" },
  { text: "Champions aren't made in gyms. Champions are made from something they have deep inside them: a desire, a dream, a vision.", by: "Muhammad Ali, boxer" },
  { text: "The marathon can humble you.", by: "Bill Rodgers, marathoner" },
  { text: "No human is limited.", by: "Eliud Kipchoge, marathoner" },
];

/** The quote for plan week n (1-based). Cycles if the plan is longer than the list. */
export function quoteForWeek(n: number): Quote {
  const i = ((Math.max(1, Math.floor(n)) - 1) % QUOTES.length + QUOTES.length) % QUOTES.length;
  return QUOTES[i];
}
