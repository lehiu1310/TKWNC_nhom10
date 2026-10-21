import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import species from '../../data/species.json';
import displayImageData from '../../data/display_images.json';

const FEATURED_SPECIES = species.filter((item) => item.featured).sort((a, b) => a.featured_order - b.featured_order);
const storyPhoto = (flower) => displayImageData.images[flower.display_image_key || flower.id];
const sceneWash = (hex) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return '#fff9f1';
  const source = match[1].match(/.{2}/g).map((channel) => Number.parseInt(channel, 16));
  const paper = [255, 249, 241];
  return `#${source.map((channel, index) => Math.round(paper[index] * .92 + channel * .08).toString(16).padStart(2, '0')).join('')}`;
};

export default function ScrollGarden() {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const sceneRefs = useRef([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const scenes = sceneRefs.current.filter(Boolean);
    const updateActive = () => {
      const focusY = window.innerHeight * .42;
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      scenes.forEach((scene, index) => {
        const rect = scene.getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.bottom) / 2 - focusY);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      setActive((previous) => previous === nearest ? previous : nearest);
    };
    if (!('IntersectionObserver' in window)) {
      let frame = 0;
      const onScroll = () => {
        if (frame) return;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          updateActive();
        });
      };
      updateActive();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', updateActive);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', updateActive);
        if (frame) window.cancelAnimationFrame(frame);
      };
    }
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current) setActive(scenes.indexOf(current.target));
    }, { threshold: [0.2, 0.45, 0.7], rootMargin: '-18% 0px -18% 0px' });
    scenes.forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let cancelled = false;
    let context;
    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([gsapModule, triggerModule]) => {
      if (cancelled) return;
      const gsap = gsapModule.default;
      const { ScrollTrigger } = triggerModule;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
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
        for (let index = 1; index < scenes.length; index += 1) {
          const at = index - .25;
          timeline.to(stageRef.current, { backgroundColor: sceneWash(FEATURED_SPECIES[index].scene_background), duration: .9, ease: 'none' }, at);
          timeline.to(scenes[index - 1], { x: 0, y: 0, autoAlpha: 0, z: -300, rotateY: -22, rotateX: -8, scale: .74, duration: .85, ease: 'power2.in' }, at);
          timeline.fromTo(scenes[index], { x: 0, y: 0, autoAlpha: 0, z: 260, rotateY: 25, rotateX: 10, scale: .68 }, { x: 0, y: 0, autoAlpha: 1, z: 0, rotateY: 0, rotateX: 0, scale: 1, duration: 1.15, ease: 'power3.out' }, at + .2);
          timeline.fromTo(scenes[index].querySelector('.scene-flower'), { y: 35, rotateZ: -9 }, { y: 0, rotateZ: 0, duration: 1.15, ease: 'power2.out' }, at + .2);
        }
      }, sectionRef);
    }).catch((error) => console.error('Không tải được hiệu ứng cuộn 3D:', error));
    return () => {
      cancelled = true;
      context?.revert();
    };
  }, []);

  return <section className="scroll-garden" id="the-gioi-hoa" ref={sectionRef}>
    <div className="cinema-stage" ref={stageRef} style={{ backgroundColor: sceneWash(FEATURED_SPECIES[0].scene_background) }}>
      <div className="stage-paper-grain" aria-hidden="true"/>
      <div className="stage-garden-backdrop" aria-hidden="true">
        {FEATURED_SPECIES.map((flower, index) => <img className={`stage-garden-photo${active === index ? ' is-active' : ''}`} key={flower.id} src={storyPhoto(flower)?.url || `/images/species/${encodeURIComponent(flower.id)}.webp`} alt="" loading={index < 2 ? 'eager' : 'lazy'}/>) }
      </div>
      <div className="stage-topline"><span>VƯỜN HOA · BỘ SƯU TẬP 01</span><span>CUỘN ĐỂ KHÁM PHÁ <b>↓</b></span></div>
      <div className="stage-scene-stack">
        {FEATURED_SPECIES.map((flower, index) => <article className="flower-scene" key={flower.id} ref={(node) => { sceneRefs.current[index] = node; }} aria-hidden={active !== index && !window.matchMedia('(prefers-reduced-motion: reduce)').matches} style={{ '--flower-backdrop': `url("${storyPhoto(flower)?.url || `/images/species/${encodeURIComponent(flower.id)}.webp`}")` }}>
          <div className="scene-copy">
            <span className="scene-index">{String(index + 1).padStart(2, '0')}<i/>{String(FEATURED_SPECIES.length).padStart(2, '0')} · FLORA NOTES</span>
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
            <img className="scene-flower display-flower-photo" style={{ '--display-photo-grade': displayImageData.colorGrading.cssFilter }} src={storyPhoto(flower)?.url || `/images/species/${encodeURIComponent(flower.id)}.webp`} alt="" loading={index < 2 ? 'eager' : 'lazy'}/>
            <span className="scene-petal petal-one"/><span className="scene-petal petal-two"/><span className="scene-petal petal-three"/>
          </div>
        </article>)}
      </div>
      <div className="stage-progress"><span>01</span><div className="progress-rail"><i style={{ transform: `scaleX(${(active + 1) / FEATURED_SPECIES.length})` }}/></div><span>{String(FEATURED_SPECIES.length).padStart(2, '0')}</span></div>
      <div className="stage-side-note">MỘT KHU VƯỜN · NĂM CÂU CHUYỆN</div>
    </div>
  </section>;
}
