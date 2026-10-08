// Quote of the week: one per plan week. Attributions are kept to ones that are well documented;
// anonymous sayings are marked Unknown, proverbs as proverbs.

export interface Quote { text: string; by: string }

export const QUOTES: Quote[] = [
  { text: "The miracle isn't that I finished. The miracle is that I had the courage to start.", by: "John Bingham" },
  { text: "A journey of a thousand miles begins with a single step.", by: "Lao Tzu" },
  { text: "Hard work beats talent when talent doesn't work hard.", by: "Tim Notke" },
  { text: "Get a bicycle. You will not regret it, if you live.", by: "Mark Twain" },
  { text: "Fall seven times, stand up eight.", by: "Japanese proverb" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
  { text: "Jogging is very beneficial. It's good for your legs and your feet. It's also very good for the ground. It makes it feel needed.", by: "Jack Handey" },
  { text: "Life is like riding a bicycle. To keep your balance you must keep moving.", by: "Albert Einstein" },
  { text: "You miss 100% of the shots you don't take.", by: "Wayne Gretzky" },
  { text: "Slow and steady wins the race.", by: "Aesop" },
  { text: "All truly great thoughts are conceived while walking.", by: "Friedrich Nietzsche" },
  { text: "Don't watch the clock; do what it does. Keep going.", by: "Sam Levenson" },
  { text: "Run when you can, walk if you have to, crawl if you must; just never give up.", by: "Dean Karnazes" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", by: "Chinese proverb" },
  { text: "I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion.", by: "Muhammad Ali" },
  { text: "Little by little, one travels far.", by: "Spanish proverb" },
  { text: "Those who think they have no time for bodily exercise will sooner or later have to find time for illness.", by: "Edward Stanley" },
  { text: "Rome wasn't built in a day.", by: "Proverb" },
  { text: "If you are losing faith in human nature, go out and watch a marathon.", by: "Kathrine Switzer" },
  { text: "Every mile is two in winter.", by: "George Herbert" },
  { text: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.", by: "Martin Luther King Jr." },
  { text: "Well done is better than well said.", by: "Benjamin Franklin" },
  { text: "You don't have to go fast. You just have to go.", by: "Unknown" },
  { text: "I can't go on, I'll go on.", by: "Samuel Beckett" },
  { text: "Ask yourself: can I give more? The answer is usually yes.", by: "Paul Tergat" },
  { text: "The only bad workout is the one that didn't happen.", by: "Unknown" },
  { text: "Champions keep playing until they get it right.", by: "Billie Jean King" },
  { text: "Run the mile you are in.", by: "Runners' saying" },
  { text: "Fitness is not about being better than someone else. It's about being better than you used to be.", by: "Unknown" },
  { text: "When the spirits are low, when the day appears dark, when work becomes monotonous, just mount a bicycle and go out for a spin down the road.", by: "Arthur Conan Doyle" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", by: "Jim Ryun" },
  { text: "Start where you are. Use what you have. Do what you can.", by: "Arthur Ashe" },
  { text: "The body achieves what the mind believes.", by: "Unknown" },
  { text: "Diligence is the mother of good luck.", by: "Benjamin Franklin" },
  { text: "Your legs are not giving out. Your head is giving up. Keep going.", by: "Unknown" },
  { text: "It's a slow process, but quitting won't speed it up.", by: "Unknown" },
  { text: "Patience, persistence and perspiration make an unbeatable combination for success.", by: "Napoleon Hill" },
  { text: "Walking is the best possible exercise. Habituate yourself to walk very far.", by: "Thomas Jefferson" },
  { text: "Out on the roads there is fitness and self-discovery and the persons we were destined to be.", by: "George Sheehan" },
  { text: "Today's pain is tomorrow's power.", by: "Unknown" },
  { text: "Never underestimate the power of a good walk.", by: "Unknown" },
  { text: "Do something today that your future self will thank you for.", by: "Unknown" },
  { text: "Done is better than perfect.", by: "Unknown" },
  { text: "The hardest step is the first one out the door.", by: "Unknown" },
  { text: "A bad day on the bike still beats a good day on the couch.", by: "Unknown" },
  { text: "Discipline is doing it even when you don't feel like it.", by: "Unknown" },
  { text: "Small steps every day.", by: "Unknown" },
  { text: "One more week. You've done harder.", by: "Unknown" },
  { text: "There will be days you don't think you can run a marathon. There will be a lifetime of knowing you have.", by: "Unknown" },
  { text: "Taper is not quitting. Rest is part of the plan.", by: "Coach's saying" },
  { text: "Trust the training.", by: "Runners' saying" },
  { text: "Today you get to find out what all those weeks were for.", by: "Unknown" },
];

/** The quote for plan week n (1-based). Cycles if the plan is longer than the list. */
export function quoteForWeek(n: number): Quote {
  const i = ((Math.max(1, Math.floor(n)) - 1) % QUOTES.length + QUOTES.length) % QUOTES.length;
  return QUOTES[i];
}
