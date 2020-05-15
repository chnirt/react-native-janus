import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  ScrollView,
  Alert,
  Button,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  RTCVideoView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';

import Janus from '../janus.mobile.js';
import config from '../config.js';

let server = config.JanusWssHost;

let janus;
let sfutest = null;
let started = false;

let myusername = Math.floor(Math.random() * 1000);
let roomId = 1234;
let myid = null;
let mystream = null;

let feeds = [];
var bitrateTimer = [];

Janus.init({
  debug: 'all',
  callback: function() {
    if (started) {
      return;
    }
    started = true;
  },
});

const VideoScreen = props => {
  const route = useRoute();
  // const myusername = route?.params?.myusername;
  // const [ds, setDs] = useState(
  //   new FlatList.DataSource({rowHasChanged: (r1, r2) => true}),
  // );
  const [state, setState] = useState({
    info: 'Initializing',
    status: 'init',
    roomID: '',
    isFront: true,
    selfViewSrc: null,
    selfViewSrcKey: null,
    remoteList: {},
    remoteListPluginHandle: {},
    textRoomConnected: false,
    textRoomData: [],
    textRoomValue: '',
    publish: false,
    speaker: false,
    audioMute: false,
    videoMute: false,
    visible: false,
  });

  useEffect(() => {
    janusStart();
  }, []);

  function janusStart() {
    setState(s => ({...s, visible: true}));
    janus = new Janus({
      server,
      success: () => {
        janus.attach({
          plugin: 'janus.plugin.videoroom',
          success: pluginHandle => {
            sfutest = pluginHandle;
            let register = {
              request: 'join',
              room: roomId,
              ptype: 'publisher',
              display: myusername,
            };
            sfutest.send({message: register});
          },
          error: error => {
            Alert.alert('  -- Error attaching plugin...', error);
          },
          consentDialog: on => {},
          mediaState: (medium, on) => {},
          webrtcState: on => {},
          onmessage: (msg, jsep) => {
            console.log(msg);
            var event = msg['videoroom'];
            if (event != undefined && event != null) {
              if (event === 'joined') {
                myid = msg['id'];
                this.publishOwnFeed(true);
                setState(s => ({...s, visible: false}));
                if (
                  msg['publishers'] !== undefined &&
                  msg['publishers'] !== null
                ) {
                  var list = msg['publishers'];
                  for (var f in list) {
                    var id = list[f]['id'];
                    var display = list[f]['display'];
                    this.newRemoteFeed(id, display);
                  }
                }
              } else if (event === 'destroyed') {
              } else if (event === 'event') {
                if (
                  msg['publishers'] !== undefined &&
                  msg['publishers'] !== null
                ) {
                  var list = msg['publishers'];
                  for (var f in list) {
                    let id = list[f]['id'];
                    let display = list[f]['display'];
                    this.newRemoteFeed(id, display);
                  }
                } else if (
                  msg['leaving'] !== undefined &&
                  msg['leaving'] !== null
                ) {
                  var leaving = msg['leaving'];
                  var remoteFeed = null;
                  let numLeaving = parseInt(msg['leaving']);
                  if (state.remoteList.hasOwnProperty(numLeaving)) {
                    delete state.remoteList.numLeaving;
                    setState(s => ({...s, remoteList: state.remoteList}));
                    state.remoteListPluginHandle[numLeaving].detach();
                    delete state.remoteListPluginHandle.numLeaving;
                  }
                } else if (
                  msg['unpublished'] !== undefined &&
                  msg['unpublished'] !== null
                ) {
                  var unpublished = msg['unpublished'];
                  if (unpublished === 'ok') {
                    sfutest.hangup();
                    return;
                  }
                  let numLeaving = parseInt(msg['unpublished']);
                  if (state.remoteList.hasOwnProperty(numLeaving)) {
                    delete state.remoteList.numLeaving;
                    setState(s => ({...s, remoteList: state.remoteList}));
                    state.remoteListPluginHandle[numLeaving].detach();
                    delete state.remoteListPluginHandle.numLeaving;
                  }
                } else if (
                  msg['error'] !== undefined &&
                  msg['error'] !== null
                ) {
                }
              }
            }
            if (jsep !== undefined && jsep !== null) {
              sfutest.handleRemoteJsep({jsep: jsep});
            }
          },
          onlocalstream: stream => {
            setState(s => ({
              ...s,
              selfViewSrc: stream.toURL(),
              selfViewSrcKey: Math.floor(Math.random() * 1000),
              status: 'ready',
              info: 'Please enter or create room ID',
            }));
          },
          onremotestream: stream => {},
          oncleanup: () => {
            mystream = null;
          },
        });
      },
      error: error => {
        Alert.alert('  Janus Error', error);
      },
      destroyed: () => {
        Alert.alert('  Success for End Call ');
        setState(s => ({...s, publish: false}));
      },
    });
  }

  function switchVideoType() {
    sfutest.changeLocalCamera();
  }

  function toggleAudioMute() {
    props.App.test();
    let muted = sfutest.isAudioMuted();
    if (muted) {
      sfutest.unmuteAudio();
      setState(s => ({...s, audioMute: false}));
    } else {
      sfutest.muteAudio();
      setState(s => ({...s, audioMute: true}));
    }
  }

  function toggleVideoMute() {
    let muted = sfutest.isVideoMuted();
    if (muted) {
      setState(s => ({...s, videoMute: false}));
      sfutest.unmuteVideo();
    } else {
      setState(s => ({...s, videoMute: true}));
      sfutest.muteVideo();
    }
  }

  function toggleSpeaker() {
    if (state.speaker) {
      setState(s => ({...s, speaker: false}));
      // InCallManager.setForceSpeakerphoneOn(false);
    } else {
      setState(s => ({...s, speaker: true}));
      // InCallManager.setForceSpeakerphoneOn(true);
    }
  }

  function endCall() {
    janus.destroy();
  }

  function publishOwnFeed(useAudio) {
    if (!state.publish) {
      setState(s => ({...s, publish: true}));
      sfutest.createOffer({
        media: {
          audioRecv: false,
          videoRecv: false,
          audioSend: useAudio,
          videoSend: true,
        },
        success: jsep => {
          var publish = {request: 'configure', audio: useAudio, video: true};
          sfutest.send({message: publish, jsep: jsep});
        },
        error: error => {
          Alert.alert('WebRTC error:', error);
          if (useAudio) {
            publishOwnFeed(false);
          } else {
          }
        },
      });
    } else {
      // this.setState({ publish: false });
      // let unpublish = { "request": "unpublish" };
      // sfutest.send({"message": unpublish});
    }
  }

  function newRemoteFeed(id, display) {
    let remoteFeed = null;
    janus.attach({
      plugin: 'janus.plugin.videoroom',
      success: pluginHandle => {
        remoteFeed = pluginHandle;
        let listen = {
          request: 'join',
          room: roomId,
          ptype: 'listener',
          feed: id,
        };
        remoteFeed.send({message: listen});
      },
      error: error => {
        Alert.alert('  -- Error attaching plugin...', error);
      },
      onmessage: (msg, jsep) => {
        let event = msg['videoroom'];
        if (event != undefined && event != null) {
          if (event === 'attached') {
            // Subscriber created and attached
          }
        }
        if (jsep !== undefined && jsep !== null) {
          remoteFeed.createAnswer({
            jsep: jsep,
            media: {audioSend: false, videoSend: false},
            success: jsep => {
              var body = {request: 'start', room: roomId};
              remoteFeed.send({message: body, jsep: jsep});
            },
            error: error => {
              Alert.alert('WebRTC error:', error);
            },
          });
        }
      },
      webrtcState: on => {},
      onlocalstream: stream => {},
      onremotestream: stream => {
        setState(s => ({...s, info: 'One peer join!'}));
        const remoteList = state.remoteList;
        const remoteListPluginHandle = state.remoteListPluginHandle;
        remoteList[id] = stream.toURL();
        remoteListPluginHandle[id] = remoteFeed;
        setState(s => ({
          ...s,
          remoteList: remoteList,
          remoteListPluginHandle: remoteListPluginHandle,
        }));
      },
      oncleanup: () => {
        if (remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
          remoteFeed.spinner.stop();
        remoteFeed.spinner = null;
        if (
          bitrateTimer[remoteFeed.rfindex] !== null &&
          bitrateTimer[remoteFeed.rfindex] !== null
        )
          clearInterval(bitrateTimer[remoteFeed.rfindex]);
        bitrateTimer[remoteFeed.rfindex] = null;
      },
    });
  }

  return (
    <View style={styles.contianer}>
      <Text>Video {route?.params?.myusername}</Text>
      <ScrollView>
        <View style={styles.container}>
          {state.selfViewSrc && (
            <RTCView
              key={state.selfViewSrcKey}
              streamURL={state.selfViewSrc}
              style={styles.remoteView}
            />
          )}
          {state.remoteList &&
            Object.keys(state.remoteList).map((key, index) => {
              return (
                <RTCView
                  key={Math.floor(Math.random() * 1000)}
                  streamURL={state.remoteList[key]}
                  style={styles.remoteView}
                />
              );
            })}
        </View>

        <View style={{flex: 1, flexDirection: 'row'}}>
          {/* {state.audioMute ? (
            <Icon
              raised
              name="microphone-off"
              type="material-community"
              color="grey"
              onPress={toggleAudioMute}
            />
          ) : (
            <Icon
              raised
              name="microphone"
              type="material-community"
              color="black"
              onPress={toggleAudioMute}
            />
          )} */}

          {/* {state.videoMute ? (
            <Icon
              raised
              name="video-off"
              type="material-community"
              color="grey"
              onPress={toggleVideoMute}
            />
          ) : (
            <Icon
              raised
              name="video"
              type="material-community"
              color="black"
              onPress={toggleVideoMute}
            />
          )} */}

          {/* {state.speaker ? (
            <Icon
              raised
              name="volume-up"
              type="FontAwesome"
              color="black"
              onPress={toggleSpeaker}
            />
          ) : (
            <Icon
              raised
              name="volume-down"
              type="FontAwesome"
              color="black"
              onPress={toggleSpeaker}
            />
          )} */}

          {/* <Icon
            raised
            name="video-switch"
            type="material-community"
            color="black"
            onPress={switchVideoType}
          />
          <Icon
            raised
            name="phone-hangup"
            type="material-community"
            color="red"
            onPress={endCall}
          /> */}
        </View>
        <View style={{flex: 1}}>
          {/* <Spinner
            visible={state.visible}
            textContent={'Connecting...'}
            textStyle={{color: '#FFF'}}
          /> */}
        </View>
      </ScrollView>
    </View>
  );
};

export default VideoScreen;

const styles = StyleSheet.create({
  contianer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfView: {
    width: 200,
    height: 150,
  },
  remoteView: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height / 2.35,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  listViewContainer: {
    height: 150,
  },
});
