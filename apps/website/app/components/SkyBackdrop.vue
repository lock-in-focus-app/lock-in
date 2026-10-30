<!-- Nearer than the stars: drifting nebulae, two planets and satellites gliding across. Light
     pollution hides them; a clear sky shows them. -->
<template>
  <div class="nebulae" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <div class="bodies" aria-hidden="true">
    <div class="world big">
      <span class="w-ring back"></span>
      <span class="ball"><span class="bands"></span></span>
      <span class="w-ring front"></span>
      <span class="moons"><i></i></span>
    </div>
    <div class="world small">
      <span class="ball"><span class="bands"></span></span>
    </div>
    <i class="sky-sat" style="--t: 75s; --d: -20s; --y0: 22vh; --y1: 6vh"></i>
    <i class="sky-sat" style="--t: 110s; --d: -70s; --y0: 48vh; --y1: 30vh"></i>
    <i class="sky-sat" style="--t: 90s; --d: -5s; --y0: 80vh; --y1: 58vh"></i>
  </div>
</template>
