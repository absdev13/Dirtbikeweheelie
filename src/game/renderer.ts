import { PX_PER_METER, WheelieSimulation } from './simulation';

export class WheelieRenderer {
  public render(
    ctx: CanvasRenderingContext2D,
    sim: WheelieSimulation,
    width: number,
    height: number
  ) {
    ctx.save();

    // 1. Sky & Horizon Backdrop
    this.drawBackdrop(ctx, sim, width, height);

    // 2. Camera Transform with decaying trauma shake
    const shakeMag = sim.shakeTrauma * sim.shakeTrauma * 14;
    const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
    const shakeY = (Math.random() - 0.5) * 2 * shakeMag;

    ctx.translate(width * 0.34 + shakeX, height * 0.62 + shakeY);
    ctx.scale(sim.camZoom, sim.camZoom);
    ctx.translate(-sim.camX, -sim.camY);

    // 3. World Props, Hazard Telegraphs & Terrain
    this.drawTerrainAndHazards(ctx, sim, width, height);

    // 4. World-Space Wheelie Balance Arc Guide (subtle perimeter around rear wheel)
    if (sim.inWheelie && !sim.isCrashed) {
      this.drawWorldBalanceArc(ctx, sim);
    }

    // 5. Dirtbike & Articulated Rider
    this.drawDirtbikeAndRider(ctx, sim);

    // 6. Pooled Particles (Roost, Sparks, Smoke, Dust)
    this.drawParticles(ctx, sim);

    ctx.restore();

    // 7. Hit Flash Overlay
    if (sim.screenFlash > 0.01) {
      ctx.save();
      ctx.fillStyle = sim.screenFlashColor;
      ctx.globalAlpha = sim.screenFlash * 0.38;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  private drawBackdrop(
    ctx: CanvasRenderingContext2D,
    sim: WheelieSimulation,
    width: number,
    height: number
  ) {
    const course = sim.course;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.78);
    skyGrad.addColorStop(0, course.skyTop);
    skyGrad.addColorStop(0.68, course.skyBottom);
    skyGrad.addColorStop(1, course.horizonGlow);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Sun or Floodlight Moon glow
    const sunX = width * 0.74 - ((sim.camX * 0.012) % (width * 0.4));
    const sunY = height * 0.26;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
    sunGrad.addColorStop(0, 'rgba(255, 247, 237, 0.92)');
    sunGrad.addColorStop(0.25, course.horizonGlow + '88');
    sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 190, 0, Math.PI * 2);
    ctx.fill();

    // Far Parallax Mountains (0.08x speed)
    ctx.fillStyle = course.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let sx = 0; sx <= width + 40; sx += 40) {
      const wx = sx + sim.camX * 0.08;
      const my =
        height * 0.56 +
        Math.sin(wx * 0.0022) * 58 +
        Math.cos(wx * 0.0051) * 26;
      ctx.lineTo(sx, my);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Near Parallax Mesa / Ridges (0.2x speed)
    ctx.fillStyle = course.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let sx = 0; sx <= width + 32; sx += 32) {
      const wx = sx + sim.camX * 0.2;
      const steppedMesa =
        Math.sin(wx * 0.0034) * 44 +
        Math.sign(Math.sin(wx * 0.0019)) * 18 +
        Math.cos(wx * 0.008) * 12;
      const my = height * 0.65 + steppedMesa;
      ctx.lineTo(sx, my);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  private drawTerrainAndHazards(
    ctx: CanvasRenderingContext2D,
    sim: WheelieSimulation,
    width: number,
    height: number
  ) {
    const viewLeft = sim.camX - width * 0.65;
    const viewRight = sim.camX + width * 1.15;
    const step = 14;

    // 1. Draw Wind Gust Updraft streaks behind terrain
    for (let i = 0; i < sim.hazards.length; i++) {
      const h = sim.hazards[i];
      if (h.endX < viewLeft || h.startX > viewRight) continue;

      if (h.type === 'WIND_GUST') {
        const now = performance.now() * 0.003;
        ctx.save();
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.18)';
        ctx.lineWidth = 2;
        for (let wx = h.startX; wx <= h.endX; wx += 48) {
          const gy = sim.getTerrainHeight(wx);
          const offset = ((now * 90 + wx) % 180);
          ctx.beginPath();
          ctx.moveTo(wx, gy - offset);
          ctx.lineTo(wx + 12, gy - offset - 46);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 2. Draw Subsoil Polygon
    ctx.fillStyle = sim.course.groundSubsoil;
    ctx.beginPath();
    ctx.moveTo(viewLeft, sim.camY + height);
    for (let wx = viewLeft; wx <= viewRight; wx += step) {
      ctx.lineTo(wx, sim.getTerrainHeight(wx));
    }
    ctx.lineTo(viewRight, sim.camY + height);
    ctx.closePath();
    ctx.fill();

    // 3. Draw Top Surface Crust & Hazard coloring
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let prevX = viewLeft;
    let prevY = sim.getTerrainHeight(viewLeft);

    for (let wx = viewLeft + step; wx <= viewRight; wx += step) {
      const wy = sim.getTerrainHeight(wx);
      const haz = sim.getHazardAt(wx);

      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(wx, wy);

      if (haz?.type === 'MUD_PIT') {
        ctx.strokeStyle = '#2B150D';
      } else if (haz?.type === 'KICKER_RAMP' || haz?.type === 'TABLETOP') {
        ctx.strokeStyle = '#D97706';
      } else {
        ctx.strokeStyle = sim.course.groundSurface;
      }
      ctx.stroke();

      prevX = wx;
      prevY = wy;
    }

    // 4. Draw Distance Markers (every 25m) & Hazard Telegraph Signs
    const firstMeter = Math.floor(viewLeft / PX_PER_METER / 25) * 25;
    const lastMeter = Math.ceil(viewRight / PX_PER_METER / 25) * 25;

    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let m = Math.max(25, firstMeter); m <= lastMeter; m += 25) {
      const mx = m * PX_PER_METER;
      const my = sim.getTerrainHeight(mx);

      // Marker post
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx, my - 26);
      ctx.stroke();

      // Sign plate
      ctx.fillStyle = '#181A20';
      ctx.fillRect(mx - 20, my - 40, 40, 15);
      ctx.strokeStyle = sim.course.accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(mx - 20, my - 40, 40, 15);

      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(`${m}M`, mx, my - 29);
    }

    // Hazard entrance telegraph stakes
    for (let i = 0; i < sim.hazards.length; i++) {
      const h = sim.hazards[i];
      if (h.startX < viewLeft || h.startX > viewRight) continue;
      const hy = sim.getTerrainHeight(h.startX);

      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(h.startX, hy);
      ctx.lineTo(h.startX, hy - 48);
      ctx.stroke();

      // Pennant flag
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(h.startX, hy - 48);
      ctx.lineTo(h.startX + 26, hy - 40);
      ctx.lineTo(h.startX, hy - 32);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawWorldBalanceArc(ctx: CanvasRenderingContext2D, sim: WheelieSimulation) {
    ctx.save();
    ctx.translate(sim.x, sim.y - 16);

    const radius = 84;
    const degToRad = (deg: number) => (-deg * Math.PI) / 180;

    // Background arc (0° to 95°)
    ctx.beginPath();
    ctx.arc(0, 0, radius, degToRad(95), degToRad(0));
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Sweet Spot Arc (Green)
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      radius,
      degToRad(sim.bike.balanceSweetSpotMax),
      degToRad(sim.bike.balanceSweetSpotMin)
    );
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 7;
    ctx.stroke();

    // 12 O'Clock Scrape Zone Arc (Gold/Amber)
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      radius,
      degToRad(sim.bike.loopOutAngle),
      degToRad(sim.bike.scrapeAngleMin)
    );
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Current Bike Angle Needle
    const currentRad = -sim.angle;
    const nx = Math.cos(currentRad) * (radius + 6);
    const ny = Math.sin(currentRad) * (radius + 6);

    ctx.beginPath();
    ctx.moveTo(Math.cos(currentRad) * (radius - 10), Math.sin(currentRad) * (radius - 10));
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = sim.isScraping ? '#FBBF24' : sim.inSweetSpot ? '#10B981' : '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  private drawDirtbikeAndRider(ctx: CanvasRenderingContext2D, sim: WheelieSimulation) {
    ctx.save();

    // Translate to Rear Tire contact patch, then lift to Rear Axle center (radius = 22)
    const wheelRadius = 22;
    ctx.translate(sim.x, sim.y - wheelRadius);

    // Rotate bike by pitch angle (counter-clockwise nose up = negative canvas rotation)
    ctx.rotate(-sim.angle);

    // Rear suspension compression lowers the chassis slightly relative to the rear axle
    const chassisDrop = sim.rearComp * 8;

    // 1. Rear Wheel (at origin 0, 0)
    this.drawWheel(ctx, 0, 0, wheelRadius, sim.rearWheelSpinAngle, sim.bike.rimColor, sim.rearBrakeHeat);

    // 2. Front Wheel position (wheelbase = 76px, affected by front fork compression)
    const forkTravel = (1 - sim.frontComp) * 9;
    const frontWheelX = 76;
    const frontWheelY = 2 - chassisDrop + (9 - forkTravel);
    this.drawWheel(ctx, frontWheelX, frontWheelY, wheelRadius, sim.frontWheelSpinAngle, sim.bike.rimColor, 0);

    // 3. Swingarm & Rear Coil-Over Shock
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(26, -12 + chassisDrop);
    ctx.stroke();

    // Rear shock spring
    ctx.strokeStyle = sim.bike.primaryColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(14, -6 + chassisDrop * 0.5);
    ctx.lineTo(24, -26 + chassisDrop);
    ctx.stroke();

    // 4. Engine Crankcase & Expansion Chamber Exhaust Pipe
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(20, -24 + chassisDrop, 24, 18, 4);
    ctx.fill();

    // Exhaust header + silencer
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(38, -14 + chassisDrop);
    ctx.quadraticCurveTo(48, -10 + chassisDrop, 26, -26 + chassisDrop);
    ctx.lineTo(-28, -36 + chassisDrop);
    ctx.stroke();

    // 5. Main Perimeter Frame
    ctx.strokeStyle = sim.bike.frameColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(24, -10 + chassisDrop);
    ctx.lineTo(58, -34 + chassisDrop);
    ctx.lineTo(30, -30 + chassisDrop);
    ctx.closePath();
    ctx.stroke();

    // 6. Telescopic Upside-Down Front Forks & Handlebars
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(frontWheelX, frontWheelY);
    ctx.lineTo(64, -24 + chassisDrop);
    ctx.stroke();

    // Upper anodized fork tubes
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(64, -24 + chassisDrop);
    ctx.lineTo(55, -46 + chassisDrop);
    ctx.stroke();

    // Handlebars & Front Number Plate
    const barX = 53;
    const barY = -50 + chassisDrop;
    ctx.fillStyle = sim.bike.primaryColor;
    ctx.beginPath();
    ctx.moveTo(56, -44 + chassisDrop);
    ctx.lineTo(68, -38 + chassisDrop);
    ctx.lineTo(63, -24 + chassisDrop);
    ctx.closePath();
    ctx.fill();

    // 7. Fuel Tank, Seat & Rear Fender with Titanium Scrape Block
    ctx.fillStyle = sim.bike.primaryColor;
    ctx.beginPath();
    ctx.moveTo(58, -38 + chassisDrop);
    ctx.lineTo(34, -36 + chassisDrop);
    ctx.lineTo(-36, -42 + chassisDrop); // Rear fender tail tip!
    ctx.lineTo(-14, -30 + chassisDrop);
    ctx.lineTo(32, -26 + chassisDrop);
    ctx.closePath();
    ctx.fill();

    // Seat foam
    ctx.fillStyle = sim.bike.secondaryColor;
    ctx.beginPath();
    ctx.moveTo(40, -37 + chassisDrop);
    ctx.quadraticCurveTo(18, -33 + chassisDrop, -6, -39 + chassisDrop);
    ctx.lineTo(-10, -34 + chassisDrop);
    ctx.lineTo(38, -32 + chassisDrop);
    ctx.closePath();
    ctx.fill();

    // Titanium Tail Scrape Spark Block at (-36, -42)
    ctx.fillStyle = sim.isScraping ? '#FEF08A' : '#94A3B8';
    ctx.beginPath();
    ctx.arc(-36, -41 + chassisDrop, sim.isScraping ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fill();

    // 8. Articulated Rider (or Ragdoll if crashed)
    if (!sim.isCrashed) {
      this.drawArticulatedRider(ctx, sim, chassisDrop, barX, barY);
    }

    ctx.restore();

    // Draw tumbling ragdoll rider if crashed
    if (sim.isCrashed) {
      ctx.save();
      ctx.translate(sim.ragdollX, sim.ragdollY);
      ctx.rotate(sim.ragdollAngle);
      // Torso
      ctx.strokeStyle = sim.bike.primaryColor;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, 14);
      ctx.stroke();
      // Helmet
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(0, -22, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawWheel(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    radius: number,
    spinAngle: number,
    rimColor: string,
    brakeHeat: number
  ) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(spinAngle);

    // Knobby Rubber Tire
    ctx.strokeStyle = '#141619';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Knobby Tread Blocks
    ctx.fillStyle = '#0B0D11';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(radius - 1, -2, 3.5, 4);
      ctx.restore();
    }

    // Anodized Alloy Rim
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 6, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (radius - 6), Math.sin(a) * (radius - 6));
      ctx.lineTo(-Math.cos(a) * (radius - 6), -Math.sin(a) * (radius - 6));
      ctx.stroke();
    }

    // Brake Rotor Disc (glows orange-red when feathering the rear brake!)
    ctx.fillStyle =
      brakeHeat > 0.08
        ? `rgba(255, ${Math.round(140 - brakeHeat * 100)}, 20, ${0.55 + brakeHeat * 0.45})`
        : '#94A3B8';
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawArticulatedRider(
    ctx: CanvasRenderingContext2D,
    sim: WheelieSimulation,
    chassisDrop: number,
    barX: number,
    barY: number
  ) {
    const leanOffset = sim.riderLean * 11;
    const squashY = sim.riderSquash * 14;

    // Footpeg & Seat anchor coordinates
    const pegX = 20;
    const pegY = -10 + chassisDrop;

    let hipX = 10 + leanOffset * 0.6;
    let hipY = -42 + chassisDrop - squashY;

    let shoulderX = 28 + leanOffset * 1.1;
    let shoulderY = -68 + chassisDrop - squashY;

    // Adjust rider posture for active Stunt Tricks!
    if (sim.activeTrick === 'SEAT_STAND') {
      hipX = 8 + leanOffset * 0.5;
      hipY = -66 + chassisDrop;
      shoulderX = 24 + leanOffset;
      shoulderY = -92 + chassisDrop;
    } else if (sim.activeTrick === 'FENDER_SCRAPE') {
      hipX = 2;
      hipY = -40 + chassisDrop;
      shoulderX = 14;
      shoulderY = -64 + chassisDrop;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Legs (Hip -> Knee -> Boot on Footpeg or Seat)
    if (sim.activeTrick === 'NAC_NAC') {
      // Back leg kicked high over the rear fender!
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(-22, -62 + chassisDrop);
      ctx.lineTo(-42, -56 + chassisDrop);
      ctx.stroke();
    }

    const footTargetX = sim.activeTrick === 'SEAT_STAND' ? 12 : pegX;
    const footTargetY = sim.activeTrick === 'SEAT_STAND' ? -36 + chassisDrop : pegY;
    const kneeX = (hipX + footTargetX) * 0.5 + 10;
    const kneeY = (hipY + footTargetY) * 0.5 - 4;

    // Thigh
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    // Motocross Boot & Shin
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footTargetX, footTargetY);
    ctx.stroke();

    // 2. Torso / Motocross Jersey
    ctx.strokeStyle = sim.bike.primaryColor;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    // Chest protector accent
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hipX + 2, hipY - 5);
    ctx.lineTo(shoulderX + 2, shoulderY + 4);
    ctx.stroke();

    // 3. Arms (Shoulder -> Elbow -> Handlebars, or raised high on ONE_HANDER!)
    if (sim.activeTrick === 'ONE_HANDER') {
      // Left arm raised high in celebration!
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY);
      ctx.lineTo(shoulderX - 14, shoulderY - 22);
      ctx.lineTo(shoulderX - 8, shoulderY - 38);
      ctx.stroke();
    }

    // Right arm gripping handlebars
    const elbowX = (shoulderX + barX) * 0.5 - 4;
    const elbowY = (shoulderY + barY) * 0.5 + 4;
    ctx.strokeStyle = sim.bike.primaryColor;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(barX, barY);
    ctx.stroke();

    // 4. Motocross Helmet with Peak Visor & Goggles
    const headX = shoulderX + 4;
    const headY = shoulderY - 12;

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(headX, headY, 9.5, 0, Math.PI * 2);
    ctx.fill();

    // Helmet stripe & visor peak
    ctx.fillStyle = sim.bike.primaryColor;
    ctx.beginPath();
    ctx.moveTo(headX + 2, headY - 9);
    ctx.lineTo(headX + 16, headY - 6);
    ctx.lineTo(headX + 8, headY - 2);
    ctx.closePath();
    ctx.fill();

    // Goggle lens
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(headX + 4, headY - 3, 6, 4.5);
  }

  private drawParticles(ctx: CanvasRenderingContext2D, sim: WheelieSimulation) {
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      if (!p.active) continue;

      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.kind === 'spark') {
        // Streak line for fast sparks
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.85;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
