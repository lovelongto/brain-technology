/**
 * 本地音乐播放器核心逻辑
 * 功能：文件读取、AudioContext解码、Web Audio API可视化、播放控制
 */
class MusicPlayer {
    constructor() {
        // DOM 元素
        this.fileInput = document.getElementById('file-input');
        this.mobileFileInput = document.getElementById('mobile-file-input');
        this.playlistContainer = document.getElementById('playlist-container');
        this.mobilePlaylistContent = document.getElementById('mobile-playlist-content');
        this.searchInput = document.getElementById('search-input');
        this.mobileSearchInput = document.getElementById('mobile-search-input');
        this.playBtn = document.getElementById('play-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.seekSlider = document.getElementById('seek-slider');
        this.volumeSlider = document.getElementById('volume-slider');
        this.muteBtn = document.getElementById('mute-btn');
        this.loopBtn = document.getElementById('loop-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.progressBar = document.getElementById('progress-bar');
        this.currentTimeEl = document.getElementById('current-time');
        this.durationEl = document.getElementById('duration');
        this.currentTitleEl = document.getElementById('current-title');
        this.currentArtistEl = document.getElementById('current-artist');
        this.coverImg = document.getElementById('cover-img');
        this.albumArt = document.getElementById('album-art');
        this.visualizerCanvas = document.getElementById('visualizer');
        this.trackCountEl = document.getElementById('track-count');
        this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
        this.mobilePlaylist = document.getElementById('mobile-playlist');
        this.closeMobilePlaylist = document.getElementById('close-mobile-playlist');

        // 状态
        this.playlist = []; // { file, name, url, buffer? }
        this.currentIndex = -1;
        this.isPlaying = false;
        this.isShuffle = false;
        this.loopMode = 0; // 0: no loop, 1: loop all, 2: loop one

        // Audio Context & Nodes
        this.audioCtx = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.analyser = null;
        this.animationId = null;

        // 初始化
        this.initEvents();
        this.initVisualizer();
        // 从当前目录下的 musics 文件夹读取可用音频（请求目录列表并解析）
        this.loadMusicsFromFolder();
        //AudioContext 初始化
        this.initAudioCtx();
    }

    async initAudioCtx() {
        // 确保 AudioContext 已初始化（必须在用户交互后）
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.setupAudioNodes();
        } else if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }
    }

    getFilteredPlaylist() {
        const keyword = (this.searchInput ? this.searchInput.value.trim().toLowerCase() : '');
        const mobileKeyword = (this.mobileSearchInput ? this.mobileSearchInput.value.trim().toLowerCase() : '');
        const finalKeyword = keyword || mobileKeyword;
        if (!finalKeyword) return this.playlist;

        return this.playlist.filter((track) => {
            const name = (track.name || '').toLowerCase();
            const fileName = (track.file ? track.file.name : (track.url || '')).toLowerCase();
            return name.includes(finalKeyword) || fileName.includes(finalKeyword);
        });
    }

    // 从服务器上列出的目录抓取 musics 下的音频文件并加入播放列表
    async loadMusicsFromFolder() {
        try {
            const resp = await fetch('./musics/');
            if (!resp.ok) {
                console.warn('无法读取 musics 目录：', resp.status);
                return;
            }
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const anchors = Array.from(doc.querySelectorAll('a'));
            const exts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
            // 使用 fetch 的响应 URL 作为 base，确保相对链接被正确解析
            // const base = resp.url;
            for (const a of anchors) {
                const href = a.getAttribute('href');
                if (!href) continue;
                const lower = href.toLowerCase();
                if (exts.some(ext => lower.endsWith(ext))) {
                    // 构造相对 URL（保留原始文件名中的空格/中文）
                    // 1. 安全解码
                    const decoded = decodeURIComponent(href).replace(/^.*\//,'');
                    const url = `./musics/${decoded}`;
                    // const url = new URL(href, base).href; // 正确的绝对 URL
                    // 2. 移除扩展名
                    // ^(.+?) 捕获组：非贪婪匹配任意字符
                    // \.     匹配点号
                    // [^.]+$ 匹配末尾非点号字符
                    // 替换为 $1 (即保留点号前的部分)
                    const name = decoded.replace(/^(.+?)\.[^.]+$/, '$1');
                    // const name = decodeURIComponent(href).replace(/\.[^/.]+$/, '');
                    this.playlist.push({ file: null, name, url, buffer: null });
                }
            }

            if (this.playlist.length) {
                this.renderPlaylist();
                if (this.trackCountEl) this.trackCountEl.textContent = `${this.playlist.length} 首`;
            }
        } catch (e) {
            console.error('读取 musics 文件夹失败', e);
        }
    }

    initEvents() {
        console.log("初始化");

        // 文件选择
        if (this.fileInput) this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        if (this.mobileFileInput) this.mobileFileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // 搜索音乐
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (this.mobileSearchInput) this.mobileSearchInput.value = value;
                this.handleSearch();
            });
        }
        if (this.mobileSearchInput) {
            this.mobileSearchInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (this.searchInput) this.searchInput.value = value;
                this.handleSearch();
            });
        }

        // 播放控制
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.playPrev());
        this.nextBtn.addEventListener('click', () => this.playNext());

        // 进度与音量
        this.seekSlider.addEventListener('input', (e) => this.seek(e.target.value));
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.muteBtn.addEventListener('click', () => this.toggleMute());

        // 模式切换
        this.loopBtn.addEventListener('click', () => this.toggleLoop());
        this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());

        // 移动端菜单
        this.mobileMenuBtn.addEventListener('click', () => {
            this.mobilePlaylist.classList.remove('translate-x-full');
            this.syncMobilePlaylist();
        });
        this.closeMobilePlaylist.addEventListener('click', () => {
            this.mobilePlaylist.classList.add('translate-x-full');
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlay();
            } else if (e.code === 'ArrowRight') {
                this.seek(this.seekSlider.value * 1 + 5); // 快进5秒逻辑需结合duration，此处简化
            } else if (e.code === 'ArrowLeft') {
                this.seek(this.seekSlider.value * 1 - 5);
            }
        });
    }

    handleSearch() {
        const keyword = (this.searchInput && this.searchInput.value.trim()) || (this.mobileSearchInput && this.mobileSearchInput.value.trim()) || '';
        if (this.searchInput) this.searchInput.value = keyword;
        if (this.mobileSearchInput) this.mobileSearchInput.value = keyword;
        this.renderPlaylist();
    }

    initVisualizer() {
        const canvas = this.visualizerCanvas;
        this.canvasCtx = canvas.getContext('2d');
        // 设置canvas分辨率
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        this.canvasCtx.scale(dpr, dpr);
        this.visualizerWidth = rect.width;
        this.visualizerHeight = rect.height;
    }

    async handleFiles(files) {
        console.log("handleFiles", files);
        if (!files.length) return;

        // 确保 AudioContext 已初始化（必须在用户交互后）
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.setupAudioNodes();
        } else if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        const newTracks = Array.from(files).filter(file => file.type.startsWith('audio/'));

        for (const file of newTracks) {
            const url = URL.createObjectURL(file);
            const track = {
                file: file,
                name: file.name.replace(/\.[^/.]+$/, ""), // 去除扩展名
                url: url,
                buffer: null // 懒加载解码
            };
            this.playlist.push(track);
        }

        this.renderPlaylist();
        this.trackCountEl.textContent = `${this.playlist.length} 首`;

        // 如果当前没有播放，自动播放第一首新添加的
        if (this.currentIndex === -1 && this.playlist.length > 0) {
            this.loadTrack(0);
        }
    }

    setupAudioNodes() {
        this.gainNode = this.audioCtx.createGain();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;

        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);

        this.gainNode.gain.value = this.volumeSlider.value;

        this.drawVisualizer();
    }

    renderPlaylist() {
        const filteredTracks = this.getFilteredPlaylist();

        const createItem = (track, actualIndex) => {
            const div = document.createElement('div');
            div.className = `group flex items-center justify-between p-3 rounded-lg cursor-pointer transition hover:bg-gray-700/50 ${actualIndex === this.currentIndex ? 'bg-purple-600/20 border border-purple-500/30' : 'border border-transparent'}`;
            div.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <span class="text-gray-500 text-xs w-4">${actualIndex + 1}</span>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-sm font-medium text-gray-200 truncate group-hover:text-white">${track.name}</span>
                        <span class="text-xs text-gray-500">${track.file ? '本地文件' : '在线资源'}</span>
                    </div>
                </div>
                ${actualIndex === this.currentIndex && this.isPlaying ? '<i class="fa-solid fa-chart-simple text-purple-400 animate-pulse"></i>' : ''}
            `;
            div.addEventListener('click', () => this.loadTrack(actualIndex));
            return div;
        };

        this.playlistContainer.innerHTML = '';
        this.mobilePlaylistContent.innerHTML = '';

        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="text-center text-gray-500 mt-10 text-sm">
                    <i class="fa-regular fa-folder-open text-4xl mb-2 opacity-50"></i>
                    <p>暂无音乐，请点击上方按钮添加</p>
                </div>`;
            return;
        }

        if (filteredTracks.length === 0) {
            const emptyMessage = `
                <div class="text-center text-gray-500 mt-10 text-sm">
                    <i class="fa-solid fa-magnifying-glass text-3xl mb-2 opacity-50"></i>
                    <p>没有找到“${this.searchInput.value.trim()}”相关音乐</p>
                </div>
            `;
            this.playlistContainer.innerHTML = emptyMessage;
            this.mobilePlaylistContent.innerHTML = emptyMessage;
            return;
        }

        filteredTracks.forEach((track, index) => {
            const actualIndex = this.playlist.indexOf(track);
            const item = createItem(track, actualIndex);
            const item2 = createItem(track, actualIndex);
            this.playlistContainer.appendChild(item);
            this.mobilePlaylistContent.appendChild(item2);
        });
    }

    syncMobilePlaylist() {
        // 简单重新渲染移动端列表以更新状态
        this.renderPlaylist();
    }

    async loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;

        if( this.currentIndex !== index) this.pausedAt = 0;
        this.currentIndex = index;
        const track = this.playlist[index];
        console.log('loadtrack', track);


        // UI 更新
        this.currentTitleEl.textContent = track.name;
        this.currentArtistEl.textContent = "本地音频";
        this.coverImg.src = `https://picsum.photos/400/400?random=${index}`; // 随机封面
        this.renderPlaylist(); // 更新高亮
        this.syncMobilePlaylist();

        // 停止当前播放
        if (this.sourceNode) {
            this.sourceNode.stop();
            this.sourceNode.disconnect();
        }

        // 解码音频数据用于可视化和精确控制
        try {
            let arrayBuffer;
            if (track.file) {
                console.log('track'.track);

                arrayBuffer = await track.file.arrayBuffer();
                console.log('log', arrayBuffer);
            } else if (track.url) {
                console.log('trackurl111', track);
                // debugger;
                // 从服务器拉取音频文件
                const resp = await fetch(track.url);
                if (!resp.ok) throw new Error('Fetch audio failed: ' + resp.status + ' ' + resp.url);
                arrayBuffer = await resp.arrayBuffer();
                console.log('log', arrayBuffer);
            } else {
                throw new Error('No source for track');
            }
            const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            // console.log('解码成功', audioBuffer1);
            track.buffer = audioBuffer;
            // this.playlist[this.currentIndex].buffer = audioBuffer;
            this.playBuffer(audioBuffer);
        } catch (e) {
            console.error("解码失败，尝试使用 HTMLAudioElement fallback", e);
            // Fallback: 如果解码失败（可能是格式不支持或文件损坏），使用普通 Audio 标签
            // 这里为了简化代码结构，暂不实现完整 fallback，仅提示
            alert("该音频格式无法解析用于可视化，建议转换为 MP3/WAV");
        }
    }

    playBuffer(buffer) {
        console.log('解码', buffer);

        if (!buffer) {
            console.log('没有解码');
            return
        } else if (!this.playlist[this.currentIndex].buffer) {
            console.log('奇奇怪怪');
            // debugger;
            return;
        }

        this.sourceNode = this.audioCtx.createBufferSource();
        this.sourceNode.buffer = buffer;
        this.sourceNode.connect(this.gainNode);

        // 记录开始时间以便计算进度
        this.startTime = this.audioCtx.currentTime;
        if(!this.pausedAt)
        this.pausedAt = 0;

        this.sourceNode.start(0, this.pausedAt);
        this.isPlaying = true;
        this.updatePlayButton();
        this.albumArt.classList.remove('paused-animation');


        // 监听播放结束
        this.sourceNode.onended = () => {
            
            const current = this.audioCtx.currentTime - this.startTime + this.pausedAt;
            const duration = this.playlist[this.currentIndex].buffer.duration;
            const percent = (current / duration) * 100;
            console.log("per",percent);
            if (this.isPlaying && percent >= 100) { // 如果不是手动停止
                this.pausedAt = 0;
                this.handleTrackEnd();
            }
        };

        this.startProgressLoop();
    }

    togglePlay() {
        if (this.currentIndex === -1) {
            if (this.playlist.length > 0) this.loadTrack(0);
            return;
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        if (this.isPlaying) {
            // 暂停
            this.sourceNode.stop();
            this.pausedAt += this.audioCtx.currentTime - this.startTime;
            this.isPlaying = false;
            this.albumArt.classList.add('paused-animation');
        } else {
            // 恢复播放
            this.playBuffer(this.playlist[this.currentIndex].buffer);
        }
        this.updatePlayButton();
    }

    updatePlayButton() {
        const icon = this.playBtn.querySelector('i');
        if (this.isPlaying) {
            icon.className = 'fa-solid fa-pause text-lg';
        } else {
            icon.className = 'fa-solid fa-play text-lg ml-1';
        }
    }

    playPrev() {
        let newIndex;
        if (this.isShuffle) {
            newIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            newIndex = this.currentIndex - 1;
            if (newIndex < 0) newIndex = this.playlist.length - 1;
        }
        this.loadTrack(newIndex);
    }

    playNext() {
        console.log('播放下一首', this.playlist[this.currentIndex]);
        let newIndex;
        if (this.isShuffle) {
            newIndex = Math.floor(Math.random() * this.playlist.length);
        } else {
            newIndex = this.currentIndex + 1;
            if (newIndex >= this.playlist.length) newIndex = 0;
        }
        this.pausedAt = 0;
        this.loadTrack(newIndex);
    }

    handleTrackEnd() {
        console.log('结束自动下一首', this.playlist[this.currentIndex]);
        if (this.loopMode === 2) {
            // 单曲循环
            this.loadTrack(this.currentIndex);
        } else if (this.loopMode === 1) {
            // 列表循环
            this.playNext();
        } else {
            // 不循环
            if (this.currentIndex < this.playlist.length - 1) {
                this.playNext();
            } else {
                this.isPlaying = false;
                this.updatePlayButton();
                this.albumArt.classList.add('paused-animation');
            }
        }
    }

    seek(percent) {
        console.log('pasuaAt1',this.pausedAt,this.audioCtx.currentTime);
        if (!this.playlist[this.currentIndex] || !this.playlist[this.currentIndex].buffer) return;

        // percent is 0-100
        const duration = this.playlist[this.currentIndex].buffer.duration;
        const newTime = (percent / 100) * duration;

        // 重启 source node 从新位置
        if (this.sourceNode) {
            this.sourceNode.stop();
        }

        if (this.isPlaying) {
            console.log('点击进度条', this.playlist[this.currentIndex]);
            this.sourceNode.stop();
            this.pausedAt = newTime;
            console.log('pasuaAt2',this.pausedAt,newTime);
            
            this.progressBar.style.width = `${percent}%`;
            this.currentTimeEl.textContent = this.formatTime(newTime);
            
            this.playBuffer(this.playlist[this.currentIndex].buffer);
        } else {
            // 如果处于暂停状态，只更新进度条UI，不实际播放
            this.pausedAt = newTime;
            this.progressBar.style.width = `${percent}%`;
            this.currentTimeEl.textContent = this.formatTime(newTime);
        }
    }

    startProgressLoop() {
        console.log('lobuffer', this.playlist[this.currentIndex]);
        if (!this.playlist[this.currentIndex].buffer) return;

        if (this.progressInterval) cancelAnimationFrame(this.progressInterval);

        const update = () => {
            if (!this.playlist[this.currentIndex].buffer) return;
            if (!this.isPlaying) return;

            const current = this.audioCtx.currentTime - this.startTime + this.pausedAt;
            const duration = this.playlist[this.currentIndex].buffer.duration;
            const percent = (current / duration) * 100;

            if (percent <= 100) {
                this.progressBar.style.width = `${percent}%`;
                this.seekSlider.value = percent;
                this.currentTimeEl.textContent = this.formatTime(current);
                this.durationEl.textContent = this.formatTime(duration);
                this.progressInterval = requestAnimationFrame(update);
            }
        };
        update();
    }

    setVolume(val) {
        if (this.gainNode) {
            this.gainNode.gain.value = val;
        }
        const icon = this.muteBtn.querySelector('i');
        if (val == 0) {
            icon.className = 'fa-solid fa-volume-xmark';
        } else if (val < 0.5) {
            icon.className = 'fa-solid fa-volume-low';
        } else {
            icon.className = 'fa-solid fa-volume-high';
        }
    }

    toggleMute() {
        if (this.gainNode.gain.value > 0) {
            this.lastVolume = this.gainNode.gain.value;
            this.gainNode.gain.value = 0;
            this.volumeSlider.value = 0;
        } else {
            const vol = this.lastVolume || 0.8;
            this.gainNode.gain.value = vol;
            this.volumeSlider.value = vol;
        }
        this.setVolume(this.gainNode.gain.value);
    }

    toggleLoop() {
        this.loopMode = (this.loopMode + 1) % 3;
        const icon = this.loopBtn.querySelector('i');
        if (this.loopMode === 0) {
            icon.className = 'fa-solid fa-repeat text-gray-400';
            this.loopBtn.classList.remove('text-purple-400');
        } else if (this.loopMode === 1) {
            icon.className = 'fa-solid fa-repeat text-purple-400';
            this.loopBtn.classList.add('text-purple-400');
        } else {
            icon.className = 'fa-solid fa-1 text-purple-400 font-bold'; // 近似表示单曲
            this.loopBtn.classList.add('text-purple-400');
        }
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        if (this.isShuffle) {
            this.shuffleBtn.classList.add('text-purple-400');
        } else {
            this.shuffleBtn.classList.remove('text-purple-400');
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    drawVisualizer() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationId = requestAnimationFrame(draw);

            this.analyser.getByteFrequencyData(dataArray);

            const ctx = this.canvasCtx;
            const width = this.visualizerWidth;
            const height = this.visualizerHeight;

            ctx.clearRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2; // 缩放高度

                // 渐变色
                const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
                gradient.addColorStop(0, '#a855f7'); // purple-500
                gradient.addColorStop(1, '#ec4899'); // pink-500

                ctx.fillStyle = gradient;
                // 圆角矩形
                ctx.beginPath();
                ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, 2);
                ctx.fill();

                x += barWidth;
            }
        };

        draw();
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});
