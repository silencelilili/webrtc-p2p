// import WebSocket from 'ws';
'use strict';
var selfname = '', currRoomNum = '';
var theirUsername ='';
var connectedUser; //被呼叫的用户名
var dataChannel;
var stats = new Statistics();
// websocket 服务端消息监听处理
var connection = new WebSocket('wss://wssocket.svocloud.cn');

var loginPage = document.querySelector("#login-page"), //登陆页面

  usernameInput = document.querySelector("#username"),//用户名
  roomnumberInput = document.querySelector("#roomnumber"), //房间号

  callPage = document.querySelector("#call-page"), //视频画面
  theirUsernameInput = document.querySelector("#theirs-username"), //呼叫名称

  hangUpBtn = document.querySelector("#hang-up"),

  currUser = document.querySelector("#curr-user"), //当前用户
  currResolution = document.querySelector("#curr-resolution"), //当前已经选择的分辨率
  currRoom = document.querySelector("#curr-room"), //当前房间
  userList = document.querySelector("#user-list"), //用户列表

  messageInput = document.querySelector("#sendMessage"), //输入的聊天消息
  received = document.querySelector("#received"), //消息列表
  receivedChannel = document.querySelector("#received-channel"), //消息列表
  
  dataChannelInput = document.querySelector("#sendChannel"); //输入的datachannel消息
  var resolution = document.querySelector("#resolution");

  callPage.style.display = "none";
  // roomnumberInput.value = randomName(6); // 随机生成6位数的房间号
  usernameInput.value = randomName(6); // 随机生成4位数的用户名
  resolution.value = 'threeK'; // 默认选中4k
/*********************************************************************************************/

  // var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
  // var PeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.RTCPeerConnection;

  // 登录
  function handleLogin(){
    selfname = usernameInput.value;
    // currRoomNum = roomnumberInput.value || '';
    if(selfname.length > 0) {
      send({
        type: 'login',
        name: selfname
        // room: currRoomNum
      })
      send({
        type: 'userlist'
      })
      currUser.innerHTML = selfname;
      // currResolution.innerHTML = resolution.value;
      // currRoom.innerHTML = currRoomNum;
    }
  }

  // var callrtc;
  //呼叫（发起通话）
  function handleCall(){
    theirUsername = theirUsernameInput.value;
    if(theirUsername.length > 0){
      startPeerConnection(theirUsername);
    }else{
      alert("请输入呼叫目标的姓名")
    }
  }
  //挂断远端
  function handleHangUp(){
    if(connectedUser){
      send({
        type: 'leave',
        name: connectedUser
      });
      onLeave();
    }else{
      alert("无远端连接用户！")
    }
  }

  // 断开本地链接
  function handleDisconnect(){
    send({
      type: 'disconnect',
      name: selfname
    });
    send({
      type: 'userlist',
    });
    if(stats_interval){
      clearInterval(stats_interval)
      stats_interval = null;
    }
    if(states){
      clearInterval(states);
      states = null;
    }
    window.location.reload();
    // onDisconnect();
  }

  // 共享
  function handleScreenshare_() {
    var port = chrome.runtime.connect('nhnlbloacclmpopbelhnnkfcnpdbkfai');
    chrome.desktopCapture.chooseDesktopMedia(
      ['screen', 'window'],
      port.sender.tab,
      onResponse
    )
    window.addEventListener("message", function (msg) {
      if(msg.data && msg.data.sourceId) {
        getScreen(msg.data.sourceId)
      }
    }, false)
    window.postMessage('requestScreenSourceId', '*');
  }
  function handleScreenshare(){
    navigator.MediaDevices.getDisplayMedia({ video: true })
    .then(stream => {
      console.log("Awesome");
    }, error => {
      console.log("Unable to acquire screen capture", error);
    });
  }
  // var constraints = {
  //   video: {
  //     mandatory: {
  //       chromeMediaSource: 'desktop',
  //       chromeMediaSourceId: sourceId
  //     }
  //   }
  // }
  function getScreen(sourceId) {
    navigator.mediaDevices.getUserMedia({
      video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId
      }
    }}
    )
    .then(function (stream) {
      console.log(stream)
    })
    .catch(function(err){

    })
    
  }
  /******************** websocket 监听消息 信令 ***********************/
  connection.onopen = function () {
    console.log("connected");
  }
  // 处理所有信息
  connection.onmessage = function (message) {
    console.log('got message', message.data);
  
    var data = JSON.parse(message.data);
  
    switch(data.type) {
      case 'login':
        onLogin(data);
        break;
      // case 'userlist':
      //   onShowUserList(data);
      //   break;
      case 'offer':
        receiveOffer(data.offer, data.name)
        break;
      case 'answer':
        receiveAnswer(data.answer, data.name);
        break;
      case 'candidate':
        receiveCandidate(data.candidate);
        break;
      case 'chats':
        onReceivedChat(data);
        break;
      case 'leave':
        onLeave();
        break;
      case 'disconnect':
        onDisconnect(data);
        break; 
      case 'error':
        onErrorMessage(data);
        break;    
    }
  };
  connection.onerror = function(err) {
    console.log('got error', err);
  };
  /***************************************************************************/
  

  /*********** 事件定义 ************/
  function onLogin(data){
    if(data.success === false){
      alert("Login unsuccessful, please try a different name");
    }else{
      loginPage.style.display = "none";
      callPage.style.display = "block";
      //准备好通话的通道
      startConnection();
    }
  };
  function onShowUserList(data){
    addElement(data.list)
  }
  
  // 收到聊天消息
  function onReceivedChat(data){
    console.log('Got chats message: ', data.data);
    if(data.sendname != selfname){
      received.innerHTML += `<div><p class="text-left"><span class="msg-name msg-name-l">${data.sendname} </span> <span class="msg-count msg-count-l">${data.data}</span></p></div>`;
    }else{
      received.innerHTML += `<div><p class="text-right"><span class="msg-name msg-name-r">${data.sendname}</span> <span class="msg-count msg-count-r">${data.data} </span></p></div>`;//data.data + "："+ data.sendname+"<br />";
    }
    
    received.scrollTop = received.scrollHeight;
  }
  /**
   * 挂断离开
   * 1.通知服务器我们不需要再进行通信 handleHangUp()
   * 2.告诉RTCPeerConnection进行关闭，停止发送数据流给其他用户
   * 3.再次设置链接，把连接实例设置为打开状态，以便我们接收新的通话
   */
  function onLeave(){
    localVideo.className = 'main-video';
    remoteVideo.style.display = "none";
    hangUpBtn.style.display = "none";
    connectedUser = null;
    remoteVideo.src = null;
    // localPeerConnection.close();
    // localPeerConnection.onicecandidate = null;
    // localPeerConnection.onaddstream = null;
    // setupPeerConnection(stream);
  }
  function onDisconnect(data){
    localVideo.src = null;
    localPeerConnection.close();
    localPeerConnection.onicecandidate = null;
    localPeerConnection.onaddstream = null; 
    // addElement(data.list)
    // window.location.reload();
  }
  function onErrorMessage(data){
    alert(data.message)
  }
  /********************************** 创建点对点对等连接  分割线 ********************************/
  // getUserMedia 浏览器兼容性判断
  function hasUserMedia(){
    if(navigator.mediaDevices){
      navigator.getUserMedia = navigator.mediaDevices.getUserMedia;
    }else{
      navigator.getUserMedia = navigator.getUserMedia || 
      navigator.webkitGetUserMedia || 
      navigator.mozGetUserMedia || 
      navigator.msGetUserMedia;
    }
    return !!navigator.getUserMedia;
  }
  // RTCPeerConnection 浏览器兼容性判断
  function hasRTCPeerConnection() {
    window.RTCPeerConnection = window.RTCPeerConnection ||
      window.webkitRTCPeerConnection ||
      window.mozRTCPeerConnection;
    
    window.RTCSessionDescription = window.RTCSessionDescription ||
      window.webkitRTCSessionDescription ||
      window.mozRTCSessionDescription;

    window.RTCIceCandidate = window.RTCIceCandidate ||
      window.webkitRTCIceCandidate ||
      window.mozRTCIceCandidate; 
    
    return !!window.RTCPeerConnection;
  }
  function hasFileApi(){
    return window.File && window.FileReader && window.FileList && window.Blob;
  }


  /************************* 视频流处理 *******************************/
  /**
   * webrtc连接的第一步
   * 1.获取视频流
   * 2.验证用户是否支持webrtc
   * 3.创建RTCPeerConnection对象
   */
  // 选择分辨率
  
  var constraintsList = {
    qvga: {video: {width: {exact: 320}, height: {exact: 240}}, audio: true},
    vga: {video: {width: {exact: 640}, height: {exact: 480}}, audio: true},
    hd: {video: {width: {exact: 1280}, height: {exact: 720}}, audio: true},
    fullHd: {video: {width: {exact: 1920}, height: {exact: 1080}}, audio: true},
    twoK: {video: {width: {exact: 2168}, height: {exact: 1219}}, audio: true},
    threeK: {video: {width: {exact: 3252}, height: {exact: 1829}}, audio: true},
    fourK: {video: {width: {exact: 4096}, height: {exact: 2160}}, audio: true},
    eightK: {video: {width: {exact: 7680}, height: {exact: 4320}}, audio: true}
  };
  var constraints = constraintsList['threeK'];
  
  function chooseResolution() {
    let _value = resolution.value;
    constraints = constraintsList[_value];
  }
  
  /************************************** 获取音视频设备 *************************************/
  const audioInputSelect = document.querySelector('select#audioSource');
  const audioOutputSelect = document.querySelector('select#audioOutput');
  const videoSelect = document.querySelector('select#videoSource');
  mediaDevices()
  function mediaDevices() {
    if(hasUserMedia()){
      navigator.mediaDevices.enumerateDevices()
      .then(gotDevices)
      .catch(function (error) {
        console.log(error)
      });
    }
  }
  function gotDevices(deviceInfos) {
    for (let i = 0; i < deviceInfos.length; i++) {
      const deviceInfo = deviceInfos[i];
      const option  = document.createElement('option');
      option.value = deviceInfo.deviceId;
      if (deviceInfo.kind === 'audioinput') {
        option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
        audioInputSelect.appendChild(option);
      } else if (deviceInfo.kind === 'audiooutput') {
        option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
        audioOutputSelect.appendChild(option);
      } else if (deviceInfo.kind === 'videoinput') {
        option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
        videoSelect.appendChild(option);
      } else {
        console.log('Some other kind of source/device: ', deviceInfo);
      }
    }
  }
  /*********************************** /end **************************************/


  var localPeerConnection, stream, localStream;
  var localVideo = document.querySelector("#localVideo"),
      remoteVideo = document.querySelector("#remoteVideo");

  function gotStreamSuccess(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
    if(hasRTCPeerConnection()){
      setupPeerConnection(stream);
    }else{
      alert('sorry, your browser does not support webrtc')
    }
    // return navigator.mediaDevices.enumerateDevices();
  }    
  function startConnection() {
    const audioSource = audioInputSelect.value;
    const videoSource = videoSelect.value;
    
    constraints.video.deviceId = !!videoSource ? {exact: videoSource} : undefined;
    constraints.audio = {
      noiseSuppression: true,
      echoCancellation: true,
      deviceId: audioSource ? {exact: audioSource} : undefined
    };
    if(hasUserMedia()) {
      console.log('constraints====',constraints)
      if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
        const videoTracks = localStream.getVideoTracks();
        for (let i = 0; i !== videoTracks.length; ++i) {
          videoTracks[i].stop();
        }
      }
      // if(navigator.mediaDevices){
        navigator.mediaDevices.getUserMedia(constraints)
        .then(gotStreamSuccess)
        // .then(gotDevices)
        .catch(function(error){
          console.error('getUserMedia Error', error.message, error.name)
          loginPage.style.display = "block";
          callPage.style.display = "none";
          window.location.reload();
          alert('不支持此分辨率');
          
        })
    }else{
      alert('sorry, your browser does not support webrtc')
    }
  }
  // 创建PeerConnection
  function setupPeerConnection(stream){
    var configuration = {
      "iceServers": []
    };
    localPeerConnection = new RTCPeerConnection(configuration);
    // 设置流的监听
    localPeerConnection.addStream(stream);
    localPeerConnection.onaddstream = function (e) {
      remoteVideo.srcObject = e.stream;
      console.log('stream======', e.stream)
      getStats(localPeerConnection);
    };

    // dataChannel = localPeerConnection.createDataChannel('chat');

    // localPeerConnection.ondatachannel = openDataChannel;

    // 设置ice处理事件
    localPeerConnection.onicecandidate = function (event) {
      if(event.candidate) {
        send({
          type: 'candidate',
          candidate: event.candidate
        })
      }
    };

    // addTrack
    // stream.getTracks().forEach(track => localPeerConnection.addTrack(track, stream));
    
    // 打开数据通道
    openDataChannel();

    // 获取stats
    // localVideo.videoTracks.onaddtrack = (event) => {
    //   console.log(event);
    //   console.log(`Video track: ${event.track.label} added`);
    // };
    // var selector = localPeerConnection.getRemoteStreams()[0].getAudioTracks()[0];
  }

/******************** 获取媒体流信息 （点对点连接建立后） *************************/ 
  function getStats(peer) {
    myGetStats(peer, function (results) {
      console.log('myGetStats======', results);
      // for (var i = 0; i < results.length; ++i) {
      //     var res = results[i];
          
      //     // console.log(res);
      // }
      setTimeout(function () {
          getStats(peer);
      }, 1000);
    });
  }
  function myGetStats(peer, callback) {
    if (!!navigator.mozGetUserMedia) {
        peer.getStats(
            function (res) {
                var items = [];
                res.forEach(function (result) {
                    items.push(result);
                });
                callback(items);
            },
            callback
        );
    } else {
        peer.getStats(function (res) {
          // stats.updateStats(res.result())
            var items = [];
            res.result().forEach(function (result) {
                var item = {};
                result.names().forEach(function (name) {
                    item[name] = result.stat(name);
                });
                item.id = result.id;
                item.type = result.type;
                item.timestamp = result.timestamp;
                items.push(item);
            });
            callback(items);
        });
    }
  };
  var states;
  function _getCallStatistics() {
    var _stats = stats.getStats();
    return _stats;
  }
  var isShowModal = false;
  var statisticModal = document.querySelector("#statisticModal");
  function getCallStatistics(){
    isShowModal = !isShowModal;
    if(isShowModal){
      statisticModal.style.display = 'block';
    }else{
      statisticModal.style.display = 'none';
    }
    if(states){
      clearInterval(states);
    }
    states = setInterval(() => {
      // console.log(_getCallStatistics());
      addElementStats(_getCallStatistics())
    }, 1000);
  }
/******************** /end *************************/ 

  /**
   * 发起通话
   * 首先发送offer给另一个用户，一旦用户收到这个offer，他将创建一个响应并开始交换ice候选，直到成功连接到服务器
   * @param {} user 
   */
  var stats_interval;
  function startPeerConnection(user) {
    connectedUser = user; //被呼叫的名称
    //开始创建 发送 offer
    sendOffer();

    
    // function createdOffer(description) {
    //   localPeerConnection.setLocalDescription(description)
    //   .then(() => {
    //     setLocalDescriptionSuccess(localPeerConnection);
    //   }).catch(setSessionDescriptionError);

    // }

    // function setLocalDescriptionSuccess(description) {
    //   console.error('setLocalDescription Success', description);
    // }
    // function setSessionDescriptionError(error) {
    //   console.error('setSessionDescription error', error);
    // }
  }
  //向所有PeerConnection发送Offer类型信令
  function sendOffer() {
    localPeerConnection.createOffer(function(offer) {
      localPeerConnection.setLocalDescription(offer);
      send({
        type: 'offer',
        offer: offer
      });
    }, function (error) {
      console.log('createOffer error', error)
    })
  }
  //接收到Offer类型信令后作为回应返回answer类型信令
  function receiveOffer(offer, name) {
    sendAnswer(offer, name)
  }
  //发送answer类型信令
  function sendAnswer(offer, name) {
    connectedUser = name; //name为对方名称
    localPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    localPeerConnection.createAnswer(function(answer) {
      localPeerConnection.setLocalDescription(answer);
      send({
        type: 'answer',
        answer: answer
      });
      localVideo.className = 'right-video';
      remoteVideo.className = 'main-video';
      remoteVideo.style.display = "block";
      hangUpBtn.style.display = "inline-block";
      // $("#hang-up").show();

      var pollMediaStatistics = function(){
        localPeerConnection.getStats(function (report) {
          // console.log("==================")
          // console.log(report.result())
          stats.updateStats(report.result());
        }, function(err){
          console.error(err);
        })
      }
      stats_interval = setInterval(() => {
        pollMediaStatistics()
      }, 1000);

    }, function (error) {
      console.log('createAnswer error', error);
    });
  }
  //接收到answer类型信令后将对方的session描述写入PeerConnection中
  function receiveAnswer(answer) {
    localPeerConnection.setRemoteDescription(new RTCSessionDescription(answer),
    function() {
      localVideo.className = 'right-video';
      remoteVideo.className = 'main-video';
      remoteVideo.style.display = "block";
      hangUpBtn.style.display = "inline-block";
      // $("#hang-up").show();

      var pollMediaStatistics = function(){
        localPeerConnection.getStats(function (report) {
          // console.log("==================")
          // console.log(report.result())
          stats.updateStats(report.result());
        }, function(err){
          console.error(err);
        })
      }
      stats_interval = setInterval(() => {
        pollMediaStatistics()
      }, 1000);
      console.log('Remote description success');
    },
    function(err) {
      console.error('Remote description failed');
    });
  }
  // 候选项
  function receiveCandidate(candidate){
    localPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /***************************** 摄像头/麦克风操作  分割线 *****************************************/
  
  var toggleCameraBtn = document.querySelector("#toggleCamera");
  var toggleMicrophoneBtn = document.querySelector("#toggleMicrophone");
  var mutedVideo = true;
  var mutedAudio = true;
 function handleCamera() {
    mutedVideo = !mutedVideo;
    muteVideo(mutedVideo);
    toggleCameraBtn.className = mutedVideo ? 'tool-icon camera-icon-on' : 'tool-icon camera-icon-off';
  }
  function handleMicrophone () {
    mutedAudio = !mutedAudio;
    muteAudio(mutedAudio);
    toggleMicrophoneBtn.className = mutedAudio ? 'tool-icon microphone-icon-on' : 'tool-icon microphone-icon-off';
  }

  function muteVideo(setting) {
    let _streams = [];
    if(localPeerConnection) {
      _streams = localPeerConnection.getLocalStreams();
    } else if(localStream){
      _streams = [localStream];
    }
    for (let i=0; i<_streams.length; i++) {
      let tracks = _streams[i].getVideoTracks();
      for (let j=0; j<tracks.length; j++) {
          tracks[j].enabled = setting;
      }
    }
  }

  function muteAudio(setting) {
    let _streams = [];
    if(localPeerConnection) {
      _streams = localPeerConnection.getLocalStreams();
    } else if(localStream){
      _streams = [localStream];
    }
    for (let i=0; i<_streams.length; i++) {
      let tracks = _streams[i].getAudioTracks();
      for (let j=0; j<tracks.length; j++) {
          tracks[j].enabled = setting;
      }
    }
  }
 /***************************** /end  分割线 *****************************************/


  /********************************** 建立数据通道连接  分割线 ********************************/
  //发送按钮
  function sendDataChannel(){
    // var val = dataChannelInput.value;
    // received.innerHTML += "发送：" + val + "<br />";
    // received.scrollTop = received.scrollHeight;
    // dataChannel.send(val)

    var files = document.querySelector("#files").files;
    if(files.length > 0) {
      dataChannelSend({
        type: 'start',
        data: files[0]
      });
      sendFile(files[0]);
    }
  }

  function openDataChannel() {
    var dataChannelOptions = {
      reliable: true
    };
    dataChannel = localPeerConnection.createDataChannel('chat', dataChannelOptions);
    dataChannel.onopen = function () {
      console.log('has connected');
      dataChannel.send(`${selfname} has connected`);
    }
    dataChannel.onmessage = function (event) {
      console.log('Got data channel message: ', event.data);
      receivedChannel.innerHTML += "接收：" + event.data +"<br />";
      receivedChannel.scrollTop = receivedChannel.scrollHeight;
    }
    dataChannel.onclose = function () {
      console.log('The Data channel is closed')
    }
    dataChannel.onerror = function (error) {
      console.log('Data channel Error: ', error);
    }
  }

  /***************** 将文件分块 可读 *******************/ 
  /** 
   * Base64编码
   * @param {ArrayBuffer对象} buffer  
   * 将任意二进制数据转为ASCII编码的字符
   * 在发送文件之前将其转换为Base64编码格式的数据，传送至另一个客户端后对数据进行解码，即得到与源数据文件相同格式的数据。
   * 函数接受一个ArrayBuffer对象作为参数，
   * 该对象是文件API读取文件内容时返回的值，
   * 编码函数首先分配一个新的数组，然后遍历二进制数据块并转换为字符，然后使用浏览器内置的btoa函数对字符加以修改翻译。
   */
  function arrayBufferToBase64(buffer){
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for( var i=0;i<len;i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Base64解码
   * @param {*} b64Date 
   * @param {*} contentType 
   * 第一步是遍历数组并将中间对每一个字符转化成二进制数据
   * 在得到翻译后的数组之后，需要将它转换为blob
   */
  function base64ToBlob(b64Date, contentType) {
    contentType = contentType || '';
    var byteArrays = [], byteNumbers, slice;
    for(var i=0;i<b64Date.length; i++){
      silce = b64Data[i];
      byteNumbers = new Array(slice.length);
      for(var n=0;n<slice.length;n++){
        byteNumbers[n] = slice.charCodeAt(n);
      }
      var byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }
    var blob = new Blob(byteArrays, {type: contentType});
    return blob;
  }

  /***************** 文件读取与发送 *******************/ 
  // 从文件中读取二进制数据并且发送给另一个用户
  var CHUNK_MAX = 16000;
  /**
   * 实例化FileReader对象，这是文件API专属对对象
   * 从文件中读取底层对二进制数据，流程如下:
   * 1.确认FileReader对象在DONE的状态
   * 2.初始化并获取文件数据对缓冲区引用
   * 3.建立一个递归函数，实现发送文件块对功能
   * 4.在函数中，我们从0开始读取一个文件块对字节
   * 5.在确保没有超过文件尾，否则没有数据可以读取
   * 6.将数据通过Base64格式进行编码，并且进行发送
   * 7.如果是最后一个文件块，告诉另一个用户我们已经完成文件发送
   * 8.如果还有数据需要传输，在固定的事件后发送另一个分块防止API发生泛洪
   * 9.最后通过调用sendChunk函数开始递归过程
   */
  function sendFile(file) {
    var reader = new FileReader();
    reader.onloadend = function (evt) {
      if(evt.target.readyState == FileReader.DONE) {
        var buffer = reader.result,
        start = 0,
        end = 0,
        last = false;

        // function sendChunk() {
        //   end = start + CHUNK_MAX;
        //   if(end>file.size){
        //     end = file.size;
        //     last = true;
        //   }
        //   dataChannel.send(arrayBufferToBase64(buffer.slice(start, end)));
          
        //   //如果是最后一块数据的话就发送消息，不然继续发送数据
        //   if(last == true) {
        //     dataChannelSend({
        //       type: 'end'
        //     })
        //   }else {
        //     start = end;
        //     //防止数据溢出
        //     setTimeout(function(){
        //       sendChunk();
        //     }, 100)
        //   }
        // }
        // sendChunk();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function dataChannelSend(data) {
    dataChannel.send(data)
  }


  /********************************** websocket发送聊天消息  分割线 ********************************/
  function sendMessage(){
    var val = messageInput.value;
    // received.innerHTML += selfname + "：" + val +"<br />";;
    // received.scrollTop = received.scrollHeight;
    send({
      type: 'chats',
      sendname: selfname,
      data: val
    });
    messageInput.value = "";
  }



  /******** 以json格式发送消息 *******/
  function send(message){
    if(connectedUser){
      message.name = connectedUser;
    }
    connection.send(JSON.stringify(message))
  }
  
  /********* 动态创建html ********/ 
  function addElement(data){
    var eles = "";
    for (var i = 0; i < data.length; i++) {
      const item = data[i];
      eles += "<li class='list-group-item'><span>" + item.name + "</span><span class='pull-right'>" + (item.isonline==1 ? "<span class='green'>在线</span>" : "<span class='red'>离线</span>") + "</span></li>";
      userList.innerHTML = eles;
    }
  }
  var outgoing = document.querySelector("#outgoing");
  var incoming = document.querySelector("#incoming");
  function addElementStats(data){
    var _outgoing_eles = "",
    _incoming_eles = "";
    var _outgoing = data.outgoing;
    var _incoming = data.incoming;
    _outgoing_eles += '<li class="li-title">Video: </li>'
    for(let i in _outgoing.video) {
      _outgoing_eles += `<li><span>${i}: ${_outgoing.video[i]}</span></li>`
      // console.log(i, _outgoing[i])
      outgoing.innerHTML = _outgoing_eles;
    }
    _outgoing_eles += '<li class="li-title">Audio: </li>'
    for(let i in _outgoing.audio) {
      // console.log(i, _outgoing[i])
      _outgoing_eles += `<li><span>${i}: ${_outgoing.audio[i]}</span></li>`
      outgoing.innerHTML = _outgoing_eles
    }
    _incoming_eles += '<li class="li-title">Video: </li>'
    for(let i in _incoming.video) {
      _incoming_eles += `<li><span>${i}: ${_incoming.video[i]}</span></li>`
      incoming.innerHTML = _incoming_eles
      // console.log(i, _incoming[i])
    }
    _incoming_eles += '<li class="li-title">Audio: </li>'
    for(let i in _incoming.audio) {
      _incoming_eles += `<li><span>${i}: ${_incoming.audio[i]}</span></li>`
      incoming.innerHTML = _incoming_eles
      // console.log(i, _incoming[i])
    }
  }
  /******* 随机生成n为数的字符串 *****/ 
  function randomName(n){
    var chars = ['0','1','2','3','4','5','6','7','8','9'];
    var res = "";
    for(var i = 0; i < n ; i ++) {
      var id = Math.ceil(Math.random()*9);
      res += chars[id];
    }
    return res;
  }
