---
title: "Ludum Dare 55"
date: 2024-04-14T17:45:04-03:00
draft: false
---

My game for ludum dare 55:

<iframe src="/game/feam.html" width="800" height="600" style="border:none;" onclick="this.focus();"></iframe>
<script>
document.addEventListener("keydown", function(event) {
  const keysToPrevent = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyS", "KeyD", "KeyW"];
  if (keysToPrevent.includes(event.code)) {
    event.preventDefault();  // This stops the default browser behavior
  }
}, false);
</script>

Please Enjoy and leave a like.
