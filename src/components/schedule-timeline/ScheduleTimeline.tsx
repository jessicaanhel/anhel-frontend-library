"use client";

// ============================================================================
// USED ON THE WEDDING WEBSITE (angela-simon-wedding) AS: the PROGRAM (schedule)
// section. A thin golden thread grows down the page while you scroll, with the
// rings pendant sliding down it; a gold heart slides across the sticky date
// strip to show the active day (the "date change").
// ============================================================================

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import type { RenderImage } from "../../types";
import styles from "./ScheduleTimeline.module.css";

// Adapted from angela-simon-wedding/components/invitation/ScheduleInvitation.tsx.

export type ScheduleItem = {
  time: string;
  title: string;
  description: string;
};

export type ScheduleDay = {
  // ISO date, "YYYY-MM-DD".
  date: string;
  items: ScheduleItem[];
};

export type ScheduleTimelineProps = {
  days: ScheduleDay[];
  // Shown in the sticky date strip, sliding to whichever day is in view,
  // with that day's number on top of it.
  heartSrc: string;
  // Slides down the golden thread as the timeline scrolls past.
  pendantSrc: string;
  eyebrow?: ReactNode;
  heading?: ReactNode;
  // Purely decorative, faded numbers on either side of the clickable days
  // (e.g. { before: 9, after: 14 } around 11/12/13) to make the strip look
  // like part of a wider calendar. Not real schedule days. Hidden if left out.
  edgeDays?: { before?: ReactNode; after?: ReactNode };
  // Accessible name of each date button; gets the date as "DD.MM.YY".
  jumpToLabel?: (formattedDate: string) => string;
  id?: string;
  // Extra class names, e.g. to reuse your site's own section/heading styles.
  classNames?: {
    section?: string;
    inner?: string;
    eyebrow?: string;
    heading?: string;
  };
  // Swap the default <img> for your own image component (e.g. next/image).
  renderImage?: RenderImage;
};

function dayOfMonth(iso: string) {
  return Number(iso.split("-")[2]);
}

function formatNumericDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year.slice(2)}`;
}

function joinClassNames(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

function defaultRenderImage({ src, alt, className }: Parameters<RenderImage>[0]) {
  return <img src={src} alt={alt} className={className} />;
}

function defaultJumpToLabel(formattedDate: string) {
  return `Jump to ${formattedDate}`;
}

// A schedule timeline: items alternate left/right of a thin golden thread
// that grows downward with scroll, with a pendant image sliding down it, and
// a sticky date strip where a heart slides between the day numbers and shows
// the active day's number.
export default function ScheduleTimeline(props: ScheduleTimelineProps) {
  // The scroll animations below need at least one day to map onto, so an
  // empty schedule renders nothing (checked here, before any hooks run).
  if (props.days.length === 0) return null;
  return <ScheduleTimelineContent {...props} />;
}

function ScheduleTimelineContent({
  days,
  heartSrc,
  pendantSrc,
  eyebrow,
  heading,
  edgeDays,
  jumpToLabel = defaultJumpToLabel,
  id = "schedule",
  classNames = {},
  renderImage = defaultRenderImage,
}: ScheduleTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start center", "end center"],
  });
  const pendantTop = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Where each day's block sits along the track (0-1), so the date-strip
  // heart can slide to whichever day is currently scrolled into view.
  // Seeded with an even spread and re-measured once the real layout exists.
  const evenSpread = days.map((_, index) => (index + 0.5) / days.length);
  const [measuredFractions, setDayFractions] = useState<number[]>(evenSpread);
  const [activeDay, setActiveDay] = useState(0);

  // If the days prop changes length, the old measurements are stale until
  // the effect below re-measures. framer-motion throws when useTransform's
  // input and output ranges differ in length, so fall back to the even
  // spread for that one render.
  const dayFractions = measuredFractions.length === days.length ? measuredFractions : evenSpread;

  useEffect(() => {
    function measure() {
      const track = trackRef.current;
      const trackHeight = track?.offsetHeight;
      if (!track || !trackHeight) return;
      const dayElements = dayRefs.current.slice(0, days.length);
      setDayFractions(
        dayElements.map((element) =>
          element ? (element.offsetTop + element.offsetHeight / 2) / trackHeight : 0
        )
      );
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [days]);

  // The heart's horizontal position: the centre of each day's column in the
  // strip, reached when that day's block is at the centre of the viewport.
  const columnCenters = days.map((_, index) => `${((index + 0.5) / days.length) * 100}%`);
  const heartLeft = useTransform(scrollYProgress, dayFractions, columnCenters);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    let nearest = 0;
    let nearestDistance = Infinity;
    dayFractions.forEach((fraction, index) => {
      const distance = Math.abs(value - fraction);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    setActiveDay(nearest);
  });

  function scrollToDay(index: number) {
    dayRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Global item index per day, so left/right alternation continues smoothly
  // across day boundaries without mutating a counter during render.
  const dayItemOffsets = days.reduce<number[]>((offsets, _day, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + days[index - 1].items.length);
    return offsets;
  }, []);

  // If the days prop shrinks, the active index can briefly point past the end.
  const activeDate = days[Math.min(activeDay, days.length - 1)].date;

  return (
    <section className={joinClassNames(styles.section, classNames.section)} id={id}>
      <div className={classNames.inner}>
        {eyebrow ? <p className={joinClassNames(styles.eyebrow, classNames.eyebrow)}>{eyebrow}</p> : null}
        {heading ? <h2 className={joinClassNames(styles.heading, classNames.heading)}>{heading}</h2> : null}

        <div className={styles.dateStripWrap}>
          <div className={styles.dateStripRow}>
            {edgeDays?.before !== undefined ? <span className={styles.edgeDay}>{edgeDays.before}</span> : null}

            <div className={styles.dateStrip} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
              {days.map((day, index) => (
                <button
                  type="button"
                  key={day.date}
                  className={styles.dateBtn}
                  onClick={() => scrollToDay(index)}
                  aria-label={jumpToLabel(formatNumericDate(day.date))}
                >
                  {dayOfMonth(day.date)}
                </button>
              ))}
              <motion.div className={styles.heartFloat} style={{ left: heartLeft }} aria-hidden>
                <motion.div
                  className={styles.heartIcon}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  {renderImage({ src: heartSrc, alt: "", className: styles.heartImg, sizes: "110px", priority: false })}
                </motion.div>
                <span className={styles.mainDayNumber}>{dayOfMonth(activeDate)}</span>
              </motion.div>
            </div>

            {edgeDays?.after !== undefined ? <span className={styles.edgeDay}>{edgeDays.after}</span> : null}
          </div>
        </div>

        <div className={styles.track} ref={trackRef}>
          {/* Grows downward with scroll instead of sitting fully drawn from
              the start: a trailing path behind the pendant, not a fixed
              line it slides along. Same scrollYProgress as the pendant's
              own "top", so the thread's bottom edge always meets it. */}
          <motion.div className={styles.thread} style={{ height: pendantTop }} />
          <motion.div className={styles.pendant} style={{ top: pendantTop }} aria-hidden>
            {renderImage({ src: pendantSrc, alt: "", className: styles.pendantImg, sizes: "50px", priority: false })}
          </motion.div>

          {days.map((day, dayIndex) => (
            <div
              key={day.date}
              className={styles.dayGroup}
              ref={(element) => {
                dayRefs.current[dayIndex] = element;
              }}
            >
              {day.items.map((item, itemIndex) => {
                const globalIndex = dayItemOffsets[dayIndex] + itemIndex;
                const itemSide = globalIndex % 2 === 0 ? styles.itemLeft : styles.itemRight;
                return (
                  <motion.div
                    className={`${styles.item} ${itemSide}`}
                    key={item.time + item.title}
                    initial={{ opacity: 0.35 }}
                    whileInView={{ opacity: 1 }}
                    // Only the item near the middle of the viewport is fully
                    // opaque; the rest stay dimmed until they scroll there.
                    viewport={{ margin: "-45% 0px -45% 0px", once: false }}
                    transition={{ duration: 0.4 }}
                  >
                    <p className={styles.time}>{item.time}</p>
                    <h3 className={styles.itemTitle}>{item.title}</h3>
                    <p className={styles.description}>{item.description}</p>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
