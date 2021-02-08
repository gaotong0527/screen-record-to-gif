<template>
  <div class="record-gif-page">
    <div v-if="status === 'blank'" class="blank-page">
      <p class="title">您可以通过屏幕录像来创建动画GIF</p>
      <div class="no-data">
        <svg-icon :icon-class="'blank'" class="icon"></svg-icon>
      </div>

      <p class="tip">暂无录制</p>
      <el-button
        type="primary"
        @click="startRecording"
        @changeRecording="changeRecording"
        @saveRender="changeRenderOption"
      >
        <svg-icon :icon-class="'play'" class="icon"></svg-icon>
        <span>开始录制</span>
      </el-button>
    </div>
    <recording
      v-else-if="status === 'recording'"
      :recording="recording"
      @stop="changeStatus"
      @changeRecording="changeRecording"
    ></recording>
    <preview
      v-else-if="status === 'preview'"
      :recording="recording"
      @changeStatus="changeStatus"
      @saveRender="changeRenderOption"
      @changeRecording="changeRecording"
    ></preview>
    <render-view
      v-else-if="status === 'render'"
      :recording="recording"
      :renderOptions="renderOptions"
      @changeStatus="changeStatus"
      @changeRenderOption="changeRenderOption"
      @changeRecording="changeRecording"
    ></render-view>
    <el-dialog
      title="提示"
      v-model:visible="notSupportVisible"
      width="30%"
      :show-close="false"
      :close-on-click-modal="false"
    >
      <span>该浏览器不支持录屏，请使用最新的chrome浏览器!!!</span>
    </el-dialog>
  </div>
</template>
<script>
import Recording from "./components/Recording";
import Preview from "./components/Preview";
import RenderView from "./components/RenderView";

export default {
  name: "ScreenRecord",
  components: { Recording, Preview, RenderView },

  data() {
    return {
      status: "blank", //录屏状态 未录制 blank，录制中：recording 录制结束预览preview,rendering 合成视频
      recording: null, // 录屏信息
      video: null,
      notSupportVisible: false,
      renderOptions: {} // render
    };
  },

  created() {
    if (
      !window.navigator.getDisplayMedia &&
      !window.navigator.mediaDevices &&
      !window.navigator.mediaDevices.getDisplayMedia
    ) {
      this.notSupportVisible = true;
    }
  },
  mounted() {
    // this.video = document.querySelector('video');
  },
  methods: {
    // 点击开始录制 录屏状态
    async startRecording() {
      window.$ULOG && window.$ULOG.send && window.$ULOG.send(39974);
      if (this.recording) {
        return;
      }
      try {
        const captureStream = await window.navigator.mediaDevices.getDisplayMedia(
          { video: { width: 999, height: 999 } }
        );

        this.status = "recording";
        this.recording = {
          captureStream,
          width: undefined,
          height: undefined,
          frames: []
        };
      } catch (err) {
        console.error(err);
        return;
      }
    },
    // 停止录制
    stopRecording() {
      this.status = "preview";
    },
    // 停止录制 播放录制的video
    changeStatus(data) {
      this.status = data.status;
    },
    // 更新recording
    changeRecording(data) {
      this.$set(this, "recording", data);
    },
    // 更新renderoption
    changeRenderOption(data) {
      this.$set(this, "renderOptions", data);
    }
  }
};
</script>

<style lang="less" scoped>
.record-gif-page {
  height: 100vh;
  font-family: PingFangSC-Semibold;
  .blank-page {
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
    .tip {
      font-size: 14px;
      color: #999;
    }
    .no-data {
      width: 100px;
      height: 100px;
      .icon {
        width: 100%;
        height: 100%;
      }
    }
    .el-button {
      padding: 12px 15px;
      height: unset;
    }
    .icon {
      text-align: center;
      width: 14px;
      height: 14px;
      vertical-align: middle;
    }
  }

  .flex {
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }
}
</style>
