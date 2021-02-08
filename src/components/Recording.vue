<template>
  <div class="recording-page">
    <p>录制中 {{ duration }}s</p>
    <el-button type="primary" @click="handleClick">
      <svg-icon :icon-class="'pause'" class="icon"></svg-icon>停止录制
    </el-button>
    <video class="hidden" autoplay="true" playsinline="true"></video>
    <canvas class="hidden" width="640" height="480"></canvas>
  </div>
</template>
<script>
import { timediff, utils } from "../utils/utils";
const FPS = 10;
const FRAME_DELAY = Math.floor(1000 / FPS);
export default {
  name: "Recording",
  props: {
    stop: {
      required: false,
      type: Function
    },
    changeRecording: {
      required: false,
      type: Function
    },
    recording: Object
  },
  data() {
    return {
      startTime: undefined,
      duration: "00:00",
      interval: null,
      worker: null,
      track: {}
    };
  },

  mounted() {
    this.createRecorder();
  },

  methods: {
    // 计时
    startRecordTime() {
      this.interval = setInterval(() => {
        this.duration = timediff(Date.now() - this.startTime);
      }, 1000);
    },

    // 停止录制
    handleClick() {
      window.$ULOG && window.$ULOG.send && window.$ULOG.send(39975);
      this.worker.terminate();
      clearInterval(this.interval);
      const { frames } = this.recording;
      // eslint-disable-next-line vue/no-mutating-props
      this.recording.duration =
        frames[frames.length - 1].timestamp + FRAME_DELAY;
      this.$emit("changeRecording", this.recording);
      this.track.removeEventListener("ended", this.endedListener);
      this.track.stop();
      this.$emit("stop", { status: "preview" });
    },
    endedListener() {
      const { frames } = this.recording;
      // eslint-disable-next-line vue/no-mutating-props
      this.recording.duration =
        frames[frames.length - 1].timestamp + FRAME_DELAY;
      this.$emit("changeRecording", this.recording);
      clearInterval(this.interval);
      this.worker.terminate();
      this.track.stop();
      this.$emit("stop", { status: "preview" });
    },
    // 录屏
    createRecorder() {
      const video = document.getElementsByTagName("video")[0];
      const canvas = document.getElementsByTagName("canvas")[0];
      video.srcObject = this.recording.captureStream;
      const ctx = canvas.getContext("2d");
      const worker = utils.createWebWorker(
        "setInterval(() => postMessage(null), 100)"
      );
      this.worker = worker.worker;

      this.worker.onmessage = () => {
        if (video.videoWidth === 0) {
          return;
        }
        const first = this.startTime === undefined || this.startTime === 0;
        if (first) {
          const width = video.videoWidth;
          const height = video.videoHeight;
          this.startTime = Date.now();
          // eslint-disable-next-line vue/no-mutating-props
          this.recording.width = width;
          // eslint-disable-next-line vue/no-mutating-props
          this.recording.height = height;
          this.$emit("changeRecording", this.recording);
          canvas.width = `${width}`;
          canvas.height = `${height}`;
        }
        this.startRecordTime();
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(
          0,
          0,
          this.recording.width,
          this.recording.height
        );
        // eslint-disable-next-line vue/no-mutating-props
        this.recording.frames.push({
          imageData,
          timestamp: first ? 0 : Date.now() - this.startTime
        });
        this.track = this.recording.captureStream.getVideoTracks()[0];
        this.track.addEventListener("ended", this.endedListener);
        this.$emit("changeRecording", this.recording);
      };
    }
  }
};
</script>

<style lang="less" scoped>
.recording-page {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  font-size: 20px;
  text-align: center;
  position: relative;
  overflow: hidden;
  height: calc(100% - 50px);
  .hidden {
    display: none;
  }
  /deep/.el-button {
    padding: 12px 15px;
    height: unset;
  }
  .icon {
    text-align: center;
    width: 14px;
    height: 14px;
    vertical-align: middle;
    margin-right: 5px;
  }
}
</style>
