import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import species from '../../data/species.json';
import displayImageData from '../../data/display_images.json';

gsap.registerPlugin(ScrollTrigger);
const FEATURED_SPECIES = species.slice(0, 5);
const DISPLAY_KEYS = { roses: 'rose', sunflowers: 'sunflower', tulips: 'tulip' };
const storyPhoto = (flower) => displayImageData.images[DISPLAY_KEYS[flower.id] || flower.id];

export default function ScrollGarden() {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const sceneRefs = useRef([]);
  const [active, setActive] = useState(0);

  useLayoutEffect(() => {
    let navigateToFlower;
    let onHashChange;
    let onFlowerNavigate;
    const flowerFromHash = () => window.location.hash.startsWith('#flower-') ? window.location.hash.slice('#flower-'.length) : null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const goToFlower = (id) => {
        const target = document.getElementById(`flower-${id}`);
        if (!target) return;
        setActive(FEATURED_SPECIES.findIndex((flower) => flower.id === id));
        target.scrollIntoView({ behavior: 'auto', block: 'center' });
      };
      const onFlowerNavigate = (event) => goToFlower(event.detail);
      const onHashChange = () => { const id = flowerFromHash(); if (id) goToFlower(id); };
      window.addEventListener('flower:navigate', onFlowerNavigate);
      window.addEventListener('hashchange', onHashChange);
      return () => { window.removeEventListener('flower:navigate', onFlowerNavigate); window.removeEventListener('hashchange', onHashChange); };
    }
    const context = gsap.context(() => {
      const scenes = sceneRefs.current.filter(Boolean);
      gsap.set(scenes, { x: 0, y: 0, autoAlpha: 0, z: -260, rotateY: 16, rotateX: 8, scale: .78, transformOrigin: '50% 50%' });
      gsap.set(scenes[0], { x: 0, y: 0, autoAlpha: 1, z: 0, rotateY: 0, rotateX: 0, scale: 1 });
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: () => `+=${window.innerHeight * 4.5}`,
          pin: stageRef.current,
          scrub: 1.15,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: ({ progress }) => {
            const position = progress * (FEATURED_SPECIES.length + .1);
            const index = FEATURED_SPECIES.reduce((activeIndex, flower, flowerIndex) => {
              const currentLabel = flowerIndex === 0 ? 0 : flowerIndex + .6;
              const previousLabel = flowerIndex === 1 ? 0 : flowerIndex - 1 + .6;
              const threshold = (currentLabel + previousLabel) / 2;
              return flowerIndex > 0 && position >= threshold ? flowerIndex : activeIndex;
            }, 0);
            setActive((previous) => previous === index ? previous : index);
          },
        },
      });
      timeline.addLabel(`flower-${FEATURED_SPECIES[0].id}`, 0);

      for (let index = 1; index < scenes.length; index += 1) {
        const at = index - .25;
        timeline.addLabel(`flower-${FEATURED_SPECIES[index].id}`, at + .85);
        timeline.to(stageRef.current, { backgroundColor: FEATURED_SPECIES[index].scene_background, duration: .9, ease: 'none' }, at);
        timeline.to(scenes[index - 1], { x: 0, y: 0, autoAlpha: 0, z: -300, rotateY: -22, rotateX: -8, scale: .74, duration: .85, ease: 'power2.in' }, at);
        timeline.fromTo(scenes[index], { x: 0, y: 0, autoAlpha: 0, z: 260, rotateY: 25, rotateX: 10, scale: .68 }, { x: 0, y: 0, autoAlpha: 1, z: 0, rotateY: 0, rotateX: 0, scale: 1, duration: 1.15, ease: 'power3.out' }, at + .2);
        timeline.fromTo(scenes[index].querySelector('.scene-flower'), { y: 35, rotateZ: -9 }, { y: 0, rotateZ: 0, duration: 1.15, ease: 'power2.out' }, at + .2);
      }
      navigateToFlower = (id) => {
        const trigger = timeline.scrollTrigger;
        if (!trigger || !FEATURED_SPECIES.some((flower) => flower.id === id)) return;
        setActive(FEATURED_SPECIES.findIndex((flower) => flower.id === id));
        window.scrollTo({ top: trigger.labelToScroll(`flower-${id}`), behavior: 'smooth' });
      };
      onFlowerNavigate = (event) => navigateToFlower(event.detail);
      onHashChange = () => { const id = flowerFromHash(); if (id) navigateToFlower(id); };
      window.addEventListener('flower:navigate', onFlowerNavigate);
      window.addEventListener('hashchange', onHashChange);
    }, sectionRef);
    return () => { if (onFlowerNavigate) window.removeEventListener('flower:navigate', onFlowerNavigate); if (onHashChange) window.removeEventListener('hashchange', onHashChange); context.revert(); };
  }, []);

  return <section className="scroll-garden" id="the-gioi-hoa" ref={sectionRef}>
    <div className="cinema-stage" ref={stageRef} style={{ backgroundColor: FEATURED_SPECIES[0].scene_background }}>
      <div className="stage-paper-grain" aria-hidden="true"/>
      <div className="stage-topline"><span>VƯỜN HOA · BỘ SƯU TẬP 01</span><span>CUỘN ĐỂ KHÁM PHÁ <b>↓</b></span></div>
      <div className="stage-scene-stack">
        {FEATURED_SPECIES.map((flower, index) => <article className="flower-scene" id={`flower-${flower.id}`} key={flower.id} ref={(node) => { sceneRefs.current[index] = node; }} aria-hidden={active !== index}>
          <div className="scene-copy">
            <span className="scene-index">0{index + 1}<i/>05 · FLORA NOTES</span>
            <span className="eyebrow">{flower.name_en.toUpperCase()} · {flower.bloom_season.toUpperCase()}</span>
            <h2>{flower.name_vi}</h2>
            <p>{flower.long_description || flower.description}</p>
            {flower.facts?.length > 0 && <ul className="scene-facts">{flower.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>}
            <div className="scene-meaning"><span>Ý NGHĨA</span><p>{flower.meaning}</p></div>
            <div className="scene-color"><i style={{ background: flower.color }}/><span>MÀU CỦA MÙA HOA</span></div>
          </div>
          <div className={`scene-art scene-art-${flower.id}`} style={{ '--flower-color': flower.color }} aria-hidden="true">
            <div className="art-halo"/><div className="art-orbit orbit-a"/><div className="art-orbit orbit-b"/><div className="art-shadow"/>
            <svg className="scene-scribbles" viewBox="0 0 500 600" aria-hidden="true"><path className="scribble-orbit" d="M38 365 C-2 220 77 77 226 55 C376 34 478 146 461 264 C449 348 388 376 345 344"/><path className="scribble-leaf" d="M78 205 C44 158 56 130 94 147 C119 158 113 190 78 205Z"/><path className="scribble-leaf leaf-two" d="M397 410 C427 365 457 370 450 405 C445 428 421 435 397 410Z"/><path className="scribble-spark" d="M349 103 l7 17 18 2-14 11 4 18-15-10-16 9 6-18-13-13 18-1Z"/></svg>
            <img className="scene-flower display-flower-photo" style={{ '--display-photo-grade': displayImageData.colorGrading.cssFilter }} src={storyPhoto(flower)?.url || `/api/species/${flower.id}/image`} alt="" loading={index < 2 ? 'eager' : 'lazy'}/>
            <span className="scene-petal petal-one"/><span className="scene-petal petal-two"/><span className="scene-petal petal-three"/>
          </div>
        </article>)}
      </div>
      <div className="stage-progress"><span>01</span><div className="progress-rail"><i style={{ transform: `scaleX(${(active + 1) / FEATURED_SPECIES.length})` }}/></div><span>05</span></div>
      <div className="stage-side-note">MỘT KHU VƯỜN · NĂM CÂU CHUYỆN</div>
    </div>
  </section>;
}
