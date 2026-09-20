import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import {
  LineupBuilderPage,
  type WorkflowRoute,
} from './features/lineup-builder/LineupBuilderPage.tsx';

const HERO_IMAGE = '/images/arena-landing.png';
const YOUTUBE_PLACEHOLDER = '[YOUTUBE VIDEO]';

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Lineup Engine home">
      <span className="brand-mark" aria-hidden="true">
        LE
      </span>
      <span>[PROJECT NAME]</span>
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
          <Link className="quiet-link" to="/about">
            About
          </Link>
        </div>
      </nav>
    </header>
  );
}

const workflows: Array<{
  number: string;
  title: string;
  description: string;
  to: string;
  accent: string;
}> = [
  {
    number: '01',
    title: 'Build a lineup',
    description: 'Select your five or generate one from a clear basketball intent.',
    to: '/build',
    accent: 'Create',
  },
  {
    number: '02',
    title: 'Repair',
    description: 'Keep what works, change what does not, and satisfy new constraints.',
    to: '/repair',
    accent: 'Adapt',
  },
  {
    number: '03',
    title: 'Compare',
    description: 'Put two versions side by side and make every tradeoff visible.',
    to: '/compare',
    accent: 'Decide',
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
      aria-labelledby="workflow-heading"
    >
      <div className="workflow-select__inner">
        <div className="section-heading">
          <span className="section-index">Next possession</span>
          <div>
            <p className="eyebrow">Choose a workflow</p>
            <h2 id="workflow-heading">What do you want to solve?</h2>
          </div>
        </div>
        <div className="workflow-card-grid">
          {workflows.map((workflow) => (
            <Link className="workflow-card" to={workflow.to} key={workflow.to}>
              <span className="workflow-card__number">{workflow.number}</span>
              <span className="workflow-card__accent">{workflow.accent}</span>
              <h3>{workflow.title}</h3>
              <p>{workflow.description}</p>
              <span className="workflow-card__cta">
                <span className="workflow-card__cta-label">Open workflow</span>
                <span aria-hidden="true">↗</span>
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
              About this project
            </Link>
          </div>
        </div>
        <div className="hero__content">
          <p className="eyebrow">Basketball decisions, made legible</p>
          <h1 id="hero-title">[PROJECT NAME]</h1>
          <p className="hero__subtitle">[SHORT VALUE PROPOSITION]</p>
          <p className="hero__context">[ONE ADDITIONAL LINE OF CONTEXT]</p>
          <Link className="hero__button" to="/about">
            About this project <span aria-hidden="true">↗</span>
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

function LazyVideo({ source }: { source: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoId = extractYouTubeId(source);

  if (isPlaying && videoId) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title="[FAVORITE MOMENT]"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <div className="video-poster">
      <span className="video-poster__label">Favorite basketball moment</span>
      <button type="button" onClick={() => setIsPlaying(true)} disabled={!videoId}>
        <span className="play-icon" aria-hidden="true">
          ▶
        </span>
        {videoId ? 'Play video' : '[YOUTUBE VIDEO]'}
      </button>
      <p>
        {videoId
          ? 'The privacy-enhanced player loads only after you choose to play.'
          : 'Add a YouTube video ID or URL to enable the player.'}
      </p>
      {videoId ? (
        <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">
          Watch on YouTube
        </a>
      ) : null}
    </div>
  );
}

function AboutPage() {
  return (
    <div className="standard-page about-page">
      <SiteHeader backTo="/" backLabel="Back to landing" />
      <main className="about-layout">
        <header className="about-intro">
          <p className="eyebrow">About</p>
          <h1>The thinking behind the five.</h1>
          <p>[ABOUT THE PROJECT]</p>
        </header>

        <section className="about-section about-section--bio" aria-labelledby="about-me-heading">
          <span className="about-section__number">01</span>
          <div>
            <p className="eyebrow">The creator</p>
            <h2 id="about-me-heading">About me</h2>
            <p>[ABOUT ME]</p>
          </div>
        </section>

        <section className="about-section about-section--player" aria-labelledby="player-heading">
          <span className="about-section__number">02</span>
          <div
            className="player-portrait"
            role="img"
            aria-label="Favorite player portrait placeholder"
          >
            <span>Portrait</span>
          </div>
          <div className="favorite-player-copy">
            <p className="eyebrow">Favorite player</p>
            <h2 id="player-heading">[FAVORITE PLAYER]</h2>
            <p>[WHY THIS PLAYER]</p>
            <span className="future-link">Related link can be added here</span>
          </div>
        </section>

        <section className="about-section about-section--moment" aria-labelledby="moment-heading">
          <span className="about-section__number">03</span>
          <div className="moment-heading">
            <p className="eyebrow">Favorite basketball moment</p>
            <h2 id="moment-heading">[FAVORITE MOMENT]</h2>
          </div>
          <div className="video-frame">
            <LazyVideo source={YOUTUBE_PLACEHOLDER} />
          </div>
        </section>
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
