import { EMAIL, PROJ } from '../data/projects';
import { POS, POS_KEYS, type PosKey } from '../data/positions';

/** A headline that "solves" itself. The real text stays in the DOM (screen readers, layout); the scramble overlay is aria-hidden. */
function Solve({ at, as: Tag = 'span', className = '', id, children }: { at: string; as?: 'span' | 'h2' | 'b' | 'p'; className?: string; id?: string; children: string }) {
  return (
    <Tag className={`solve ${className}`.trim()} data-solve={at} id={id}>
      <span className="real">{children}</span>
    </Tag>
  );
}

function Hero() {
  return (
    <section className="act hero" data-act="establish" aria-label="Introduction">
      <div className="pin">
        <div className="stage" data-out=".55,.95">
          <h1 className="name">
            <span className="solve l1" data-solve="time"><span className="real">Mark</span></span>{' '}
            <span className="solve l2" data-solve="time"><span className="real">Cabalbag</span></span>
          </h1>
          <div className="foot mid">
            <p className="eyebrow"><b>Establishing</b> White to move</p>
            <p className="pos">Full stack developer. I solve web problems several moves ahead.</p>
            <p className="hint">Scroll to start the analysis</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Reveal() {
  return (
    <section className="act reveal" data-act="reveal" aria-labelledby="rv-h">
      <div className="pin">
        <div className="stage" data-in=".1,.35" data-out=".9,1.01">
          <p className="eyebrow"><b>Starting position</b> 32 pieces <span>Evaluation 0.00</span></p>
          <Solve as="h2" className="h2" id="rv-h" at=".2,.55">Four positions. Four solutions. One mate.</Solve>
        </div>
      </div>
    </section>
  );
}

const PREMISES: [string, string, string, string][] = [
  ['P1', '.22', '.22,.34', 'I’m Mark Jeriel Cabalbag, a full stack developer.'],
  ['P2', '.34', '.34,.48', 'I build landing pages and web apps for businesses that need visitors to become customers.'],
  ['P3', '.48', '.48,.6', 'A visitor leaves when an objection goes unanswered.'],
  ['∴', '.6', '.6,.74', 'So every page I ship starts from the customer’s objection and answers it first.'],
];

function Opening() {
  return (
    <section className="act opening" data-act="opening" id="about" aria-labelledby="op-h">
      <div className="pin">
        <div className="stage slab fade" data-in=".12,.25" data-out=".94,1.01">
          <p className="eyebrow"><b>Opening</b> 1.e4 e5 2.d4 d5</p>
          <Solve as="h2" className="h2" id="op-h" at=".14,.3">The premises.</Solve>
          <ol className="premises">
            {PREMISES.map(([k, show, win, text], i) => (
              <li key={k} className={`step${i === 3 ? ' ther' : ''}`} data-show={show}>
                <span className="k">{k}</span>
                <Solve at={win}>{text}</Solve>
              </li>
            ))}
          </ol>
          <p className="fine step" data-show=".72">
            React, TypeScript, Next.js, Tailwind. Plain HTML, CSS and JavaScript when that is enough. 2nd Runner Up, Web Design, 12th IT Skills Olympics (50 universities, 2023).
          </p>
        </div>
      </div>
    </section>
  );
}

function Position({ k }: { k: PosKey }) {
  const p = PROJ[k];
  const P = POS[k];
  return (
    <section className="act position" data-act={k} id={k === 'knight' ? 'work' : undefined} aria-labelledby={`h-${k}`}>
      <div className="pin">
        <article className="panel" data-lenis-prevent>
          <div className="panel-in">
            <p className="eyebrow">
              <Solve as="b" at=".2,.3">{`Position ${p.no} · The Problem`}</Solve>
              <span>The {p.piece} · {p.trait}</span>
            </p>
            <Solve as="h2" className="ph" id={`h-${k}`} at=".22,.36">{p.name}</Solve>
            <p className="cat">{p.cat}</p>
            <figure className="shot step" data-show=".26">
              <picture>
                <source type="image/avif" srcSet={p.img.avif} />
                <source type="image/webp" srcSet={p.img.webp} />
                <img src={p.img.jpg} alt={p.alt} width={1600} height={1000} loading="lazy" decoding="async" />
              </picture>
            </figure>
            <div className="blk step" data-show=".3"><h3>Problem</h3><p>{p.problem}</p></div>
            <div className="blk step" data-show=".4">
              <h3>Candidates</h3>
              <ol className="cands">
                {p.cands.map(([what, why], i) => (
                  <li className="no" key={what}><span className="k">{'ab'[i]}</span><span className="what">{what}</span><span className="why">Rejected. {why}</span></li>
                ))}
                <li className="yes"><span className="k">c</span><span className="what">{p.choice}</span><span className="why">Chosen.</span></li>
              </ol>
            </div>
            <div className="blk step" data-show=".52"><h3>Decision</h3><p className="decision"><span className="mv">{P.san}</span>{p.choice}</p></div>
            <div className="blk step" data-show=".6">
              <h3>Evaluation</h3>
              <div className="figs">{p.figs.map(([v, l]) => <div key={l}><b className="count" data-v={v}>{v}</b><span>{l}</span></div>)}</div>
            </div>
            <p className="fine step" data-show=".64">{p.stack}</p>
            <a className="live step" data-show=".64" href={p.link} target="_blank" rel="noopener">View the live site</a>
          </div>
        </article>
      </div>
    </section>
  );
}

function Mate() {
  const copy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const out = (e.currentTarget.parentElement as HTMLElement).querySelector('.copied')!;
    const email = document.getElementById('email')!;
    try {
      await navigator.clipboard.writeText(EMAIL);
      out.textContent = 'Copied';
    } catch {
      const r = document.createRange();
      r.selectNodeContents(email);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
      out.textContent = 'Selected. Press Ctrl+C';
    }
  };
  return (
    <section className="act mate" data-act="mate" id="contact" aria-labelledby="mt-h">
      <div className="pin">
        <div className="stage slab fade" data-in=".42,.6">
          <p className="eyebrow"><b>Checkmate</b> 1.Qh1 Kf8 <span>White to move</span></p>
          <Solve as="h2" className="h2 big" id="mt-h" at=".46,.62">Mate in one.</Solve>
          <p className="lead">Let’s play the next move together.</p>
          <div className="email-row">
            <span id="email">{EMAIL}</span>
            <button className="btn" onClick={copy}>Copy email</button>
            <span className="copied" aria-live="polite" />
          </div>
          <ul className="socials">
            <li><a href="https://github.com/marklandingpages" target="_blank" rel="noopener">GitHub</a></li>
            <li><a href="https://marklandingpages.github.io/Meridian-Solar-Co/" target="_blank" rel="noopener">Latest launch</a></li>
          </ul>
          <p className="fine">Qh8# and Qa8# both end it. © 2026 Mark Jeriel Cabalbag</p>
        </div>
      </div>
    </section>
  );
}

export function Acts() {
  return (
    <main id="story">
      <Hero />
      <Reveal />
      <Opening />
      {POS_KEYS.map((k) => <Position key={k} k={k} />)}
      <Mate />
    </main>
  );
}
