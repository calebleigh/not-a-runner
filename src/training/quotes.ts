// Quote of the week: one per plan week. Athletes, coaches and accomplished people (no actors or celebrities),
// with some humor. Attributions are well documented. Ordered to fit the plan: easy starts and bikes in
// Foundation, a winter line in winter, grit around mile tests (weeks 14, 27, 40, 49), Kipchoge on race week.

export interface Quote { text: string; by: string }

export const QUOTES: Quote[] = [
  { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", by: "John Bingham, marathoner" },
  { text: "A journey of a thousand miles begins with a single step.", by: "Lao Tzu" },
  { text: "When I first started running, I was so embarrassed I'd walk when cars passed me. I'd pretend I was looking at the flowers.", by: "Joan Benoit Samuelson, Olympic marathon champion" },
  { text: "If you have a body, you are an athlete.", by: "Bill Bowerman, track coach" },
  { text: "Get a bicycle. You will not regret it, if you live.", by: "Mark Twain" },
  { text: "Ride as much or as little, or as long or as short as you feel. But ride.", by: "Eddy Merckx, cyclist" },
  { text: "Don't let what you cannot do interfere with what you can do.", by: "John Wooden, basketball coach" },
  { text: "Life is like riding a bicycle. To keep your balance you must keep moving.", by: "Albert Einstein" },
  { text: "Hard work beats talent when talent doesn't work hard.", by: "Tim Notke, basketball coach" },
  { text: "Ride your bike, ride your bike, ride your bike.", by: "Fausto Coppi, cyclist" },
  { text: "All truly great thoughts are conceived while walking.", by: "Friedrich Nietzsche" },
  { text: "Every mile is two in winter.", by: "George Herbert, poet" },
  { text: "If you run, you are a runner. It doesn't matter how fast or how far.", by: "John Bingham, marathoner" },
  { text: "To give anything less than your best is to sacrifice the gift.", by: "Steve Prefontaine, distance runner" },
  { text: "Walking is the best possible exercise. Habituate yourself to walk very far.", by: "Thomas Jefferson" },
  { text: "It never gets easier, you just go faster.", by: "Greg LeMond, cyclist" },
  { text: "Jogging is very beneficial. It's good for your legs and your feet. It's also very good for the ground. It makes it feel needed.", by: "Jack Handey, humorist" },
  { text: "Run when you can, walk if you have to, crawl if you must; just never give up.", by: "Dean Karnazes, ultramarathoner" },
  { text: "You miss 100% of the shots you don't take.", by: "Wayne Gretzky, hockey player" },
  { text: "Shut up, legs!", by: "Jens Voigt, cyclist" },
  { text: "Those who think they have no time for bodily exercise will sooner or later have to find time for illness.", by: "Edward Stanley, statesman" },
  { text: "The triumph can't be had without the struggle.", by: "Wilma Rudolph, Olympic sprinter" },
  { text: "Well done is better than well said.", by: "Benjamin Franklin" },
  { text: "Don't look back. Something might be gaining on you.", by: "Satchel Paige, baseball pitcher" },
  { text: "Slow and steady wins the race.", by: "Aesop" },
  { text: "Baseball is ninety percent mental and the other half is physical.", by: "Yogi Berra, baseball player" },
  { text: "The man who can drive himself further once the effort gets painful is the man who will win.", by: "Roger Bannister, first sub-four-minute mile" },
  { text: "Only the disciplined ones in life are free. If you are undisciplined, you are a slave to your moods and your passions.", by: "Eliud Kipchoge, marathoner" },
  { text: "If you are losing faith in human nature, go out and watch a marathon.", by: "Kathrine Switzer, marathoner" },
  { text: "When the spirits are low, when the day appears dark, when work becomes monotonous, just mount a bicycle and go out for a spin down the road.", by: "Arthur Conan Doyle" },
  { text: "Don't dream of winning, train for it.", by: "Mo Farah, distance runner" },
  { text: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.", by: "Martin Luther King Jr." },
  { text: "I've failed over and over and over again in my life. And that is why I succeed.", by: "Michael Jordan, basketball player" },
  { text: "Courage is resistance to fear, mastery of fear, not absence of fear.", by: "Mark Twain" },
  { text: "We all have dreams. But in order to make dreams come into reality, it takes an awful lot of determination, dedication, self-discipline, and effort.", by: "Jesse Owens, Olympic sprinter" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", by: "Jim Ryun, miler" },
  { text: "Ask yourself: can I give more? The answer is usually yes.", by: "Paul Tergat, marathoner" },
  { text: "Pressure is a privilege.", by: "Billie Jean King, tennis player" },
  { text: "I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion.", by: "Muhammad Ali, boxer" },
  { text: "A lot of people run a race to see who is fastest. I run to see who has the most guts.", by: "Steve Prefontaine, distance runner" },
  { text: "It is not the mountain we conquer but ourselves.", by: "Edmund Hillary, mountaineer" },
  { text: "I can't go on, I'll go on.", by: "Samuel Beckett, writer" },
  { text: "If you want to run, run a mile. If you want to experience a different life, run a marathon.", by: "Emil Zátopek, distance runner" },
  { text: "I trained four years to run nine seconds and people give up when they don't see results in two months.", by: "Usain Bolt, sprinter" },
  { text: "Never, ever give up.", by: "Diana Nyad, distance swimmer" },
  { text: "The real purpose of running isn't to win a race, it's to test the limits of the human heart.", by: "Bill Bowerman, track coach" },
  { text: "Out on the roads there is fitness and self-discovery and the persons we were destined to be.", by: "George Sheehan, runner and cardiologist" },
  { text: "The will to win is nothing without the will to prepare.", by: "Juma Ikangaa, marathoner" },
  { text: "It ain't over till it's over.", by: "Yogi Berra, baseball player" },
  { text: "I really think a champion is defined not by their wins but by how they can recover when they fall.", by: "Serena Williams, tennis player" },
  { text: "The marathon can humble you.", by: "Bill Rodgers, marathoner" },
  { text: "No human is limited.", by: "Eliud Kipchoge, marathoner" },
];

/** The quote for plan week n (1-based). Cycles if the plan is longer than the list. */
export function quoteForWeek(n: number): Quote {
  const i = ((Math.max(1, Math.floor(n)) - 1) % QUOTES.length + QUOTES.length) % QUOTES.length;
  return QUOTES[i];
}
