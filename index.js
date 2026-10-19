  // 点击 "Explore Music" 时初始化并播放，避免浏览器自动播放被阻止
  const playBtn = document.getElementById('play-btn');

  playBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    playBtn.textContent = 'Loading...';
    playBtn.disabled = true;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // 确保在用户交互后恢复上下文
      await audioCtx.resume();

      // 对含中文和空格的文件名进行编码
      const resp = await fetch(encodeURI('虎二 - 一百万个可能 (Live片段).mp3'));
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start(0);

      playBtn.textContent = 'Playing';
      // 可选：播放后跳转到 music.html
      setTimeout(() => { window.location.href = playBtn.href; }, 250);
    } catch (err) {
      console.error('加载或解码音频失败', err);
      playBtn.textContent = 'Play failed';
      playBtn.disabled = false;
    }
  });

//   <script>
//   const playBtn = document.getElementById('play-btn');
//   playBtn.addEventListener('click', async () => {

//     playBtn.disabled = true;

//     try {
//       // 创建音频上下文
//       const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

//       await audioCtx.resume();

//       // 对含中文和空格的文件名进行编码
//       const resp = await fetch(encodeURI('虎二 - 一百万个可能 (Live片段).mp3'));
//       const arrayBuffer = await resp.arrayBuffer();
//       const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

//       const source = audioCtx.createBufferSource();
//       source.buffer = audioBuffer;
//       source.connect(audioCtx.destination);
//       source.start(0);

//     } catch (err) {
//       console.error('加载或解码音频失败', err);
//       playBtn.textContent = 'Play failed';
//       playBtn.disabled = false;
//     }


//     // // 获取音频文件并解码
//     // fetch('虎二 - 一百万个可能 (Live片段).mp3')
//     //   .then(response => response.arrayBuffer())
//     //   .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
//     //   .then(audioBuffer => {
//     //     console.log(22200);

//     //     // 创建源节点
//     //     const source = audioCtx.createBufferSource();
//     //     source.buffer = audioBuffer;

//     //     // 连接到输出目的地
//     //     source.connect(audioCtx.destination);

//     //     // 开始播放
//     //     source.start(0);
//     //   }).catch(err => console.error('加载或解码音频失败', err));

//   })
//   this.addEventListener('DOMContentLoaded', async () => {
//     // const audio = new Audio('虎二 - 一百万个可能 (Live片段).mp3');

//     // playBtn.addEventListener('click', () => {
//     //   if (audio.paused) {
//     //     audio.play();
//     //     playBtn.innerHTML = '<i class="fa-solid fa-pause text-lg ml-1"></i>';
//     //   } else {
//     //     audio.pause();
//     //     playBtn.innerHTML = '<i class="fa-solid fa-play text-lg ml-1"></i>';
//     //   }
//     // });
//   });

// </script>