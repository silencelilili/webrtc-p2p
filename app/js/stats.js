function Statistics() {
  var self = this;
  self.audio_out = new PexRTCStreamStatistics();
  self.audio_in = new PexRTCStreamStatistics();
  self.video_out = new PexRTCStreamStatistics();
  self.video_in = new PexRTCStreamStatistics();
  self.googCpuLimitedResolution = "false";
}
Statistics.prototype.updateStats = function(results) {
  var self = this;

  var audio_send = null;
  var audio_recv = null;
  var video_send = null;
  var video_recv = null;

  for (var i = 0; i < results.length; ++i) {
      if (self.statIsOfType(results[i], 'audio', 'send')) audio_send = results[i];
      else if (self.statIsOfType(results[i], 'audio', 'recv')) audio_recv = results[i];
      else if (self.statIsOfType(results[i], 'video', 'send')) { video_send = results[i]; self.updateGoogCpuLimitedResolution(results[i]); }
      else if (self.statIsOfType(results[i], 'video', 'recv')) video_recv = results[i];
      // else if (self.statIsBandwidthEstimation(results[i])) self.video_out.updateBWEStats(results[i]);
  }

  if (audio_send) self.audio_out.updateTxStats(audio_send);
  if (audio_recv) self.audio_in.updateRxStats(audio_recv);
  if (video_send) self.video_out.updateTxStats(video_send);
  if (video_recv) self.video_in.updateRxStats(video_recv);
};

Statistics.prototype.updateStatsFF = function(results) {
  var self = this;

  var keys = results.keys();
  for (var key_i = keys.next(); !key_i.done; key_i = keys.next()) {
      var key = key_i.value;
      if (key.indexOf('outbound_rtp_audio') === 0) self.audio_out.updateTxStatsFF(results.get(key));
      else if (key.indexOf('outbound_rtcp_audio') === 0) self.audio_out.updateRtcpTxStatsFF(results.get(key));
      else if (key.indexOf('inbound_rtp_audio') === 0) self.audio_in.updateRxStatsFF(results.get(key));
      else if (key.indexOf('outbound_rtp_video') === 0) self.video_out.updateTxStatsFF(results.get(key));
      else if (key.indexOf('outbound_rtcp_video') === 0) self.video_out.updateRtcpTxStatsFF(results.get(key));
      else if (key.indexOf('inbound_rtp_video') === 0) self.video_in.updateRxStatsFF(results.get(key));
  }
};

Statistics.prototype.updateStatsSafari = function(results) {
  var self = this;

  var keys = results.keys();
  for (var key_i = keys.next(); !key_i.done; key_i = keys.next()) {
      var key = key_i.value;
      if (key.indexOf('RTCOutboundRTPAudioStream') === 0) self.audio_out.updateTxStatsFF(results.get(key));
      else if (key.indexOf('RTCInboundRTPAudioStream') === 0) self.audio_in.updateRxStatsFF(results.get(key));
      else if (key.indexOf('RTCOutboundRTPVideoStream') === 0) self.video_out.updateTxStatsFF(results.get(key));
      else if (key.indexOf('RTCInboundRTPVideoStream') === 0) self.video_in.updateRxStatsFF(results.get(key));
  }
};

Statistics.prototype.statIsBandwidthEstimation = function(result) {
  return result.type == 'VideoBwe';
};

Statistics.prototype.statIsOfType = function(result, type, direction) {
  var self = this;
  return result.type == 'ssrc' && result.stat('mediaType') == type && result.id.search(direction) != -1;
};

Statistics.prototype.updateGoogCpuLimitedResolution = function(result) {
  var self = this;

  var newLimit = result.stat('googCpuLimitedResolution');
  // && self.parent.chrome_ver > 55 && self.parent.h264_enabled == true
  if (newLimit == "true" && newLimit != self.googCpuLimitedResolution) {
      // self.parent.onLog('googCpuLimitedResolution triggered, renegotiating to VP8');
      self.googCpuLimitedResolution = newLimit;
      // self.parent.h264_enabled = false;
      // self.parent.renegotiate();
  }
};

Statistics.prototype.getStats = function() {
  var self = this;
  // if (self.parent.firefox_ver > 0 && self.parent.firefox_ver < 47) {
  //     return {};
  // }
  if (self.audio_in.lastTimestamp === null) {
      return {};
  }
  return {'outgoing': {'audio': self.audio_out.getStats(),
                       'video': self.video_out.getStats()},
          'incoming': {'audio': self.audio_in.getStats(),
                       'video': self.video_in.getStats()}};
};

function PexRTCStreamStatistics() {
  var self = this;

  self.lastPackets = 0;
  self.lastLost = 0;
  self.lastBytes = 0;
  self.lastTimestamp = null;
  self.recentTotal = 0;
  self.recentLost = 0;
  self.samples = [];
  self.info = {};
}

PexRTCStreamStatistics.prototype.getStats = function() {
  var self = this;
  return self.info;
};

PexRTCStreamStatistics.prototype.updateBWEStats = function(result) {
  var self = this;
  self.info['configured-bitrate'] = (result.stat('googTargetEncBitrate') / 1000).toFixed(1) + 'kbps';
};

PexRTCStreamStatistics.prototype.updatePacketLossStats = function(currentTotal, currentLost) {
  var self = this;
  if (currentTotal === 0) {
      self.info['percentage-lost'] = '0%';
  } else {
      self.info['percentage-lost'] = (currentLost / currentTotal * 100).toFixed(1) + '%';
  }

  var sample;
  if (self.samples.length >= 60) {
      sample = self.samples.shift();
      self.recentLost -= sample[0];
      self.recentTotal -= sample[1];
  }
  sample = [Math.max(currentLost - self.lastLost, 0), currentTotal - self.lastPackets];
  self.recentLost += sample[0];
  self.recentTotal += sample[1];
  self.samples.push(sample);

  if (self.recentTotal === 0) {
      self.info['percentage-lost-recent'] = '0%';
  } else {
      self.info['percentage-lost-recent'] = (self.recentLost / self.recentTotal * 100).toFixed(1) + '%';
  }
};

PexRTCStreamStatistics.prototype.updateRxStats = function(result) {
  var self = this;
  self.info['packets-received'] = result.stat('packetsReceived');
  self.info['packets-lost'] = result.stat('packetsLost');
  self.info['percentage-lost'] = 0;
  self.info['percentage-lost-recent'] = 0;
  self.info['bitrate'] = "unavailable";

  
         
  var packetsReceived = parseInt(self.info['packets-received']) | 0;
  var packetsLost = parseInt(self.info['packets-lost']) | 0;

  if (packetsReceived >= self.lastPackets) {
      self.updatePacketLossStats(packetsReceived, packetsLost);

      if (self.lastTimestamp > 0) {
          var kbps = Math.round((result.stat('bytesReceived') - self.lastBytes) * 8 / (result.timestamp - self.lastTimestamp));
          self.info['bitrate'] = kbps + 'kbps';
      }

      if (result.stat('googFrameHeightReceived'))
          self.info['resolution'] = result.stat('googFrameWidthReceived') + 'x' + result.stat('googFrameHeightReceived');

      if (result.stat('googCodecName'))
          self.info['codec'] = result.stat('googCodecName');

      if (result.stat('googDecodeMs'))
          self.info['decode-delay'] = result.stat('googDecodeMs') + 'ms';

      
  }

  self.lastTimestamp = result.timestamp;
  self.lastBytes = result.stat('bytesReceived');
  self.lastPackets = packetsReceived;
  self.lastLost = packetsLost;
};

PexRTCStreamStatistics.prototype.updateTxStats = function(result) {
  var self = this;

  self.info['packets-sent'] = result.stat('packetsSent');
  self.info['packets-lost'] = result.stat('packetsLost');
  self.info['percentage-lost'] = 0;
  self.info['percentage-lost-recent'] = 0;
  self.info['bitrate'] = "unavailable";

  

  var packetsSent = parseInt(self.info['packets-sent']) | 0;
  var packetsLost = parseInt(self.info['packets-lost']) | 0;

  if (packetsSent >= self.lastPackets) {
      self.updatePacketLossStats(packetsSent, packetsLost);

      if (self.lastTimestamp > 0) {
          var kbps = Math.round((result.stat('bytesSent') - self.lastBytes) * 8 / (result.timestamp - self.lastTimestamp));
          self.info['bitrate'] = kbps + 'kbps';
      }

      if (result.stat('googFrameHeightSent'))
          self.info['resolution'] = result.stat('googFrameWidthSent') + 'x' + result.stat('googFrameHeightSent');

      if (result.stat('googCodecName'))
          self.info['codec'] = result.stat('googCodecName');

      // 帧率
      if(result.stat('googFrameRateInput'))
          self.info['frameRate-input'] = result.stat('googFrameRateInput');

      if(result.stat('googFrameRateSent')) 
        self.info['frameRate-send'] = result.stat('googFrameRateSent'); 
  }

  self.lastTimestamp = result.timestamp;
  self.lastBytes = result.stat('bytesSent');
  self.lastPackets = packetsSent;
  self.lastLost = packetsLost;
};

PexRTCStreamStatistics.prototype.updateRxStatsFF = function(result) {
  var self = this;

  self.info['packets-received'] = result.packetsReceived;
  self.info['packets-lost'] = result.packetsLost;
  self.info['percentage-lost'] = 0;
  self.info['bitrate'] = "unavailable";

  var packetsReceived = parseInt(self.info['packets-received']) | 0;
  var packetsLost = parseInt(self.info['packets-lost']) | 0;

  self.updatePacketLossStats(packetsReceived, packetsLost);

  if (self.lastTimestamp > 0) {
      var tsDiff = result.timestamp - self.lastTimestamp;
      if (tsDiff > 500000) {
          // Safari is in milliseconds
          tsDiff = tsDiff / 1000;
      }
      var kbps = Math.round((result.bytesReceived - self.lastBytes) * 8 / tsDiff);
      self.info['bitrate'] = kbps + 'kbps';
  }

  self.lastTimestamp = result.timestamp;
  self.lastBytes = result.bytesReceived;
  self.lastPackets = packetsReceived;
  self.lastLost = packetsLost;
};

PexRTCStreamStatistics.prototype.updateTxStatsFF = function(result) {
  var self = this;

  self.info['packets-sent'] = result.packetsSent;
  self.info['bitrate'] = "unavailable";

  var packetsSent = parseInt(self.info['packets-sent']) | 0;

  if (self.lastTimestamp > 0) {
      var tsDiff = result.timestamp - self.lastTimestamp;
      if (tsDiff > 500000) {
          tsDiff = tsDiff / 1000;
      }
      var kbps = Math.round((result.bytesSent - self.lastBytes) * 8 / tsDiff);
      self.info['bitrate'] = kbps + 'kbps';
  }

  self.lastTimestamp = result.timestamp;
  self.lastBytes = result.bytesSent;
  self.lastPackets = packetsSent;
};

PexRTCStreamStatistics.prototype.updateRtcpTxStatsFF = function(result) {
  var self = this;

  self.info['packets-lost'] = result.packetsLost;
  //self.info['jitter'] = result.jitter;

  var packetsSent = parseInt(self.info['packets-sent']) | 0;
  var packetsLost = parseInt(self.info['packets-lost']) | 0;
  self.updatePacketLossStats(packetsSent, packetsLost);
};