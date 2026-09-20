import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import {
  LineupBuilderPage,
  type WorkflowRoute,
} from './features/lineup-builder/LineupBuilderPage.tsx';

const HERO_IMAGE = '/images/arena-landing.png';
const YOUTUBE_PLACEHOLDER = 'https://www.youtube.com/watch?v=ojM9nVvigyA';

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Lineup Engine home">
      <span>STARTING FIVE</span>
    </Link>
  );
}

function SiteHeader({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  return (
    <header className="site-header">
      <nav className="site-header__inner" aria-label="Primary navigation">
        <Link className="back-link" to={backTo}>
          <span aria-hidden="true">←</span> {backLabel}
        </Link>
        <Brand />
        <div className="site-header__actions">
          <Link className="quiet-link" to="/">
            Home
          </Link>
          <Link className="quiet-link" to="/about">
            About
          </Link>
        </div>
      </nav>
    </header>
  );
}

const workflows: Array<{
  title: string;
  description: string;
  to: string;
}> = [
  {
    title: 'Build a lineup',
    description: 'Select your five or generate one from a clear basketball intent.',
    to: '/build',
  },
  {
    title: 'Repair',
    description: 'Keep what works, change what does not, and satisfy new constraints.',
    to: '/repair',
  },
  {
    title: 'Compare',
    description: 'Put two versions side by side and make every tradeoff visible.',
    to: '/compare',
  },
];

function WorkflowSelection({ reveal = false }: { reveal?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(
    () => !reveal || typeof IntersectionObserver === 'undefined',
  );

  useEffect(() => {
    if (!reveal || !sectionRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.16 },
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [reveal]);

  return (
    <section
      ref={sectionRef}
      id="workflows"
      className={`workflow-select ${isVisible ? 'workflow-select--visible' : ''}`}
      aria-label="Lineup workflows"
    >
      <div className="workflow-select__inner">
        <div className="workflow-card-grid">
          {workflows.map((workflow) => (
            <Link className="workflow-card" to={workflow.to} key={workflow.to}>
              <h3>{workflow.title}</h3>
              <p>{workflow.description}</p>
              <span className="workflow-card__cta" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingPage() {
  return (
    <main className="landing-page">
      <section className="hero" aria-labelledby="hero-title">
        <img className="hero__image" src={HERO_IMAGE} alt="" fetchPriority="high" />
        <div className="hero__overlay" aria-hidden="true" />
        <div className="hero__topbar">
          <Brand />
          <div className="hero__topbar-actions">
            <Link className="quiet-link" to="/about">
              About Me
            </Link>
          </div>
        </div>
        <div className="hero__content">
          <p className="eyebrow">Test your NBA lineup ideas</p>
          <h1 id="hero-title">STARTING FIVE</h1>
          <p className="hero__subtitle">A place for fans and armchair GMs to explore real and hypothetical NBA lineups.</p>
          <p className="hero__context">Build a five from your favorite team, mix and match players from across the league, and compare how different combinations fit together.</p>
          <Link className="hero__button" to="/about">
            About Me <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <a className="scroll-prompt" href="#workflows">
          <span className="scroll-prompt__line" aria-hidden="true" />
          Scroll to explore
        </a>
      </section>
      <WorkflowSelection reveal />
    </main>
  );
}

function WorkflowsPage() {
  return (
    <div className="standard-page standard-page--workflows">
      <SiteHeader backTo="/" backLabel="Back to landing" />
      <main>
        <WorkflowSelection />
      </main>
    </div>
  );
}

function extractYouTubeId(value: string): string | undefined {
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0];
    if (url.hostname.endsWith('youtube.com')) {
      return url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).at(-1);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function EmbeddedVideo({ source }: { source: string }) {
  const videoId = extractYouTubeId(source);

  if (!videoId) return <div className="video-placeholder">Add a YouTube video URL.</div>;

  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}`}
      title="My favorite NBA moment"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

function AboutPage() {
  return (
    <div className="standard-page about-page">
      <SiteHeader backTo="/" backLabel="Back to landing" />
      <main className="about-layout">
        <div className="about-dashboard">
          <section className="about-section about-section--bio" aria-labelledby="about-me-heading">
            <p className="eyebrow">The creator</p>
            <h1 id="about-me-heading">About me</h1>
            <p>
              My first experience watching the NBA was the 2014 NBA Finals, where Kawhi Leanord led
              the San Antonio Spurs to beat Lebron James and the Miami Heat. Although Kawhi went on
              to leave the Spurs, I have been a fan of both ever since. Right now, the Spurs have an
              amazing young roster with a lot of young players all vying for playing time, which is
              what made me curious about playing around with different lineups and inspired me to
              create this project.
            </p>
          </section>

          <aside className="about-favorites" aria-label="Basketball favorites">
            <div className="about-image-pair">
              <figure className="favorite-image favorite-image--logo">
                <img
                  src="https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg"
                  alt="San Antonio Spurs logo"
                />
                <figcaption>San Antonio Spurs</figcaption>
              </figure>
              <figure className="favorite-image favorite-image--player">
                <img
                  src="https://cdn.nba.com/headshots/nba/latest/1040x760/202695.png"
                  alt="Kawhi Leonard"
                />
                <figcaption>Kawhi Leonard</figcaption>
              </figure>
            </div>

            <section className="about-moment" aria-labelledby="moment-heading">
              <h2 id="moment-heading">My favorite NBA moment</h2>
              <div className="video-frame">
                <EmbeddedVideo source={YOUTUBE_PLACEHOLDER} />
              </div>
            </section>
          </aside>
        </div>

        <footer className="about-socials" aria-label="Social profiles">
          <a
            href="https://www.linkedin.com/in/siddarthvuppunahalli"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn profile"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.5 8.3H3.2V21h3.3V8.3ZM4.9 3A1.9 1.9 0 1 0 5 6.8 1.9 1.9 0 0 0 4.9 3ZM21 13.7c0-3.8-2-5.6-4.7-5.6-2.2 0-3.1 1.2-3.7 2v-1.8H9.3V21h3.3v-6.3c0-1.7.3-3.3 2.4-3.3 2 0 2.1 1.9 2.1 3.4V21H21v-7.3Z" />
            </svg>
          </a>
          <a
            href="https://github.com/SiddarthVuppunahalli"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub profile"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.9.6-3.5-1.2-3.5-1.2-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.3-.3-4.7-1.2-4.7-5A3.9 3.9 0 0 1 7.6 8c-.1-.3-.5-1.3.1-2.8 0 0 .9-.3 3 1.1a10.4 10.4 0 0 1 5.5 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.5.1 2.8a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.8-4.7 5.1.4.3.7 1 .7 2V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
            </svg>
          </a>
        </footer>
      </main>
    </div>
  );
}

function WorkflowPage({ workflow }: { workflow: WorkflowRoute }) {
  return (
    <div className="standard-page workflow-page">
      <SiteHeader backTo="/#workflows" backLabel="All workflows" />
      <LineupBuilderPage routeWorkflow={workflow} />
    </div>
  );
}

function AppShell() {
  const location = useLocation();

  useEffect(() => {
    if (navigator.userAgent.toLowerCase().includes('jsdom')) return;

    if (location.hash) {
      const targetId = decodeURIComponent(location.hash.slice(1));
      window.requestAnimationFrame(() => {
        document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
      });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);

  switch (location.pathname) {
    case '/':
      return <LandingPage />;
    case '/workflows':
      return <WorkflowsPage />;
    case '/about':
      return <AboutPage />;
    case '/build':
      return <WorkflowPage workflow="build" />;
    case '/repair':
      return <WorkflowPage workflow="repair" />;
    case '/compare':
      return <WorkflowPage workflow="compare" />;
    default:
      return <Navigate to="/" replace />;
  }
}

export function App() {
  return <AppShell />;
}
