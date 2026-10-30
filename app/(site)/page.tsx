import Link from "next/link";
import { getSite } from "@/lib/content";
import { withBase } from "@/lib/basePath";
import { CardArt, HeroArt } from "@/components/Art";

export default async function Home() {
  const { home } = await getSite();
  return (
    <div className="home" data-cols={home.columns}>
      <section className="home-hero" aria-labelledby="home-title">
        {home.showArt ? <HeroArt /> : null}
        <h1 id="home-title">{home.title}</h1>
        <p className="home-lead">{home.lead}</p>
      </section>
      {home.cards.length ? (
        <section className="home-cards" aria-label="Where to start">
          {home.cards.map((c, i) => (
            <Link className="home-card" href={c.href} key={c.href + c.title} data-reveal>
              <span className="home-card-art">{c.image ? <img src={withBase(c.image)} alt="" loading="lazy" /> : <CardArt name={c.icon} id={String(i)} />}</span>
              <h2>{c.title}</h2>
              <p>{c.description}</p>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
