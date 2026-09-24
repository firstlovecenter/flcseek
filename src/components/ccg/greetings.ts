/**
 * The admin portal's hourly dashboard greeting (Synago), English only. The
 * line rotates every hour and differs per user; the bucket follows Accra time.
 */

type Bucket = 'lateNight' | 'earlyMorning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

const GREETINGS: Record<Bucket, string[]> = {
  lateNight: [
    '{{name}}, at this hour? Paul-and-Silas mode unlocked.',
    'Watchman {{name}}, what of the night? Apparently, more admin.',
    '{{name}}, even the disciples slept. Just gently saying.',
    'The spirit is willing, {{name}} — please let the flesh sleep soon.',
    "Burning oil at {{name}} o'clock. Heaven sees you.",
    'He neither slumbers nor sleeps, {{name}}. You, however, should.',
    'Midnight oil hits different.',
    'Be sober, be vigilant — and please, be horizontal soon.',
    'Lift up your hands in the sanctuary by night. Or in the dashboard.',
  ],
  earlyMorning: [
    'Rise and shine, {{name}} — mercies are new this morning.',
    'Early bird {{name}}. The worm respectfully bows.',
    "He waketh morning by morning, {{name}}. You're keeping up.",
    '{{name}}, up before sunrise — big "I sought thee early" energy.',
    'Pre-dawn admin, {{name}}. The watchman approves.',
    'Good morning, {{name}}. Joy comes in the morning — and so do you.',
    "Eyes open, {{name}}. Heart awake. Let's go.",
    "The morning stars sang together. You're the encore.",
    'New day, fresh anointing.',
    'Before the dew lifts — that kind of devotion.',
  ],
  morning: [
    'Good morning, {{name}}. Mercies: fresh out the box.',
    "Coffee in one hand, calling in the other — let's go, {{name}}.",
    'Morning, {{name}}. This is the day the Lord has made.',
    '{{name}}, the harvest is plentiful — and so is the to-do list.',
    '{{name}}, the joy of the Lord is your strength.',
    "Daylight servant hours, {{name}}. Let's move.",
    'Welcome, {{name}}. Start small, finish faithful.',
    'Strong coffee, stronger calling.',
    'Every good gift cometh down — including today.',
    'Sunrise: done. To-do list: pending.',
  ],
  midday: [
    'Midday check-in, {{name}}. Did you eat?',
    'The sun is high, {{name}}. The standards are higher.',
    '{{name}}, halfway through the day. Stand firm.',
    'Lunch break or admin break, {{name}}? Yes.',
    'Welcome back, {{name}}. The day is still yours.',
    'Be still, {{name}} — but only after the form is submitted.',
    'High noon, holy hustle.',
    'The light is at its brightest. So is the assignment.',
    'Even Elijah ate before he ran.',
  ],
  afternoon: [
    'Good afternoon, {{name}}. Finishing strong beats starting strong.',
    '{{name}}, run with patience the race set before you — even the admin part.',
    '{{name}}, faithful in little, faithful in much.',
    'Productivity window open, {{name}}. Naps are also biblical.',
    'Afternoon, {{name}}. Press on.',
    'The day is not over, {{name}}. Neither is the calling.',
    'Still standing. Still serving.',
    'The afternoon shift is undefeated.',
    'Slow and steady wins the kingdom race.',
  ],
  evening: [
    'Good evening, {{name}}. Day well used?',
    'Evening admin, {{name}}. Pastor mode: still on.',
    '{{name}}, the day is far spent — the work was good.',
    'Sun setting, {{name}}. Dashboard still glowing.',
    'Welcome back, {{name}}. One last push.',
    'He gives His beloved sleep, {{name}} — right after you mark that register.',
    'Sunset admin. Holy, but slightly tired.',
    'Cool of the day — God walks. So do you.',
    'Evening sacrifices are still acceptable.',
  ],
  night: [
    'Late shift, {{name}}? The Lord watches over you.',
    'He neither slumbers nor sleeps, {{name}}. You, on the other hand…',
    '{{name}}, faithful with the late-night details. Respect.',
    'Burning the midnight oil, {{name}} — anointed, but please rest soon.',
    'Evening, {{name}}. Rest is also worship.',
    'Quiet hours, {{name}}. Steady hands. Holy work.',
    'One more record, one more rest.',
    'Even the temple closed eventually.',
    'Twilight servant hours — clocking in quietly.',
  ],
}

function accraHour(d: Date): number {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Accra', hour: 'numeric', hour12: false }).format(d).replace(/\D/g, ''))
  if (!Number.isFinite(h)) return d.getHours()
  return h === 24 ? 0 : h
}

function bucketFor(hour: number): Bucket {
  if (hour >= 4 && hour < 7) return 'earlyMorning'
  if (hour >= 7 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'midday'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  if (hour >= 21 && hour < 24) return 'night'
  return 'lateNight'
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function hourlyGreeting(firstName: string, userKey: string, now = new Date()): string {
  const list = GREETINGS[bucketFor(accraHour(now))]
  const idx = (hash(userKey || firstName || 'guest') + Math.floor(now.getTime() / 3_600_000)) % list.length
  return list[idx].replace('{{name}}', firstName || 'there')
}

/** Wrap the first occurrence of `name` in the brand colour. */
export function splitName(text: string, name: string): [string, string, string] {
  const i = name ? text.indexOf(name) : -1
  return i === -1 ? [text, '', ''] : [text.slice(0, i), name, text.slice(i + name.length)]
}
