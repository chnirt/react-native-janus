/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, {Fragment, Component} from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Alert,
  Button,
  StyleSheet,
  View,
  Text,
} from 'react-native';

import {Janus} from './janus';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
} from 'react-native-webrtc';

import {Dimensions} from 'react-native';

// also support setRemoteDescription, createAnswer, addIceCandidate, onnegotiationneeded, oniceconnectionstatechange, onsignalingstatechange, onaddstream

const dimensions = Dimensions.get('window');

const configuration = {iceServers: [{url: 'stun:stun.l.google.com:19302'}]};
const pc = new RTCPeerConnection(configuration);
let isFront = false;

//export default
class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {streamUrl: null};
  }

  componentDidMount() {
    console.log('componentDidMount');

    mediaDevices.enumerateDevices().then(sourceInfos => {
      console.log(sourceInfos);
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind == 'videoinput' &&
          sourceInfo.facing == (isFront ? 'front' : 'back')
        ) {
          videoSourceId = sourceInfo.deviceId;
        }
      }

      mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            mandatory: {
              minWidth: 500, // Provide your own width, height and frame rate here
              minHeight: 1200,
              minFrameRate: 60,
            },
            facingMode: isFront ? 'user' : 'environment',
            optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
          },
        })
        .then(stream => {
          // Got stream!
          // this.state.stream = stream;
          this.setState(previousState => ({streamUrl: stream.toURL()}));
          console.log('Got stream !');
          console.log('Stream ID: ' + this.state.streamUrl);
        })
        .catch(error => {
          // Log error
        });
    });
  }

  render() {
    return (
      <View>
        {
          <RTCView
            streamURL={this.state.streamUrl}
            style={{width: 350, height: 600}}
          />
        }
      </View>
    );
  }
}

pc.createOffer().then(desc => {
  pc.setLocalDescription(desc).then(() => {
    // Send pc.localDescription to peer
  });
});

pc.onicecandidate = function(event) {
  // send event.candidate to peer
};

var sfutest = null;
let host = '192.168.1.4';
let server = 'http://' + host + ':8088/janus';
// let backHost = 'http://' + host + ':3000/stream';
let pin = null;
let myroom = null;
let myid = null;
let janus = null;

Janus.init({
  debug: 'all',
  callback: function() {
    if (started) return;
    started = true;
  },
});

export default class JanusReactNative extends Component {
  constructor(props) {
    super(props);
    this.state = {
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
      buttonText: 'Start for Janus !!!',
      incomingCall: false,
      jsep: {},
    };
    this.janusStart.bind(this);
    this.onPressButton.bind(this);
  }

  componentDidMount() {
    // this.janusStart();
  }

  janusStart = () => {
    this.setState({visible: true, status: 'ready'});
    janus = new Janus({
      server: server,
      success: () => {
        janus.attach({
          plugin: 'janus.plugin.videocall',
          // camera_front: true,
          success: pluginHandle => {
            sfutest = pluginHandle;
            var body = {audio: true, video: true};
            sfutest.send({message: body});
            sfutest.createOffer({
              // No media property provided: by default,
              // it's sendrecv for audio and video
              success: function(jsep) {
                // Got our SDP! Send our OFFER to the plugin
                sfutest.send({
                  message: body,
                  jsep: jsep,
                });
              },
              error: function(error) {
                // An error occurred...
              },
              customizeSdp: function(jsep) {
                // if you want to modify the original sdp, do as the following
                // oldSdp = jsep.sdp;
                // jsep.sdp = yourNewSdp;
              },
            });
          },
          error: error => {
            Alert.alert('  -- Error attaching plugin...', error);
          },
          consentDialog: on => {},
          mediaState: (medium, on) => {},
          webrtcState: on => {},
          onmessage: (msg, jsep) => {
            console.log('🥶🥶🥶🥶🥶🥶🥶🥶🥶🥶🥶🥶🥶', msg);
            var event = msg['videocall'];
            var result = msg['result'];
            console.log(event, result);
            if (result != undefined && result != null) {
              if (result.event === 'incomingcall') {
                this.setState({incomingCall: true});
              }
            }
            if (event != undefined && event != null) {
              if (event === 'joined') {
                myid = msg['id'];
                this.publishOwnFeed(true);
                this.setState({
                  visible: false,
                });
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
                  if (this.state.remoteList.hasOwnProperty(numLeaving)) {
                    delete this.state.remoteList.numLeaving;
                    this.setState({
                      remoteList: this.state.remoteList,
                    });
                    this.state.remoteListPluginHandle[numLeaving].detach();
                    delete this.state.remoteListPluginHandle.numLeaving;
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
                  if ('numLeaving' in this.state.remoteList) {
                    delete this.state.remoteList.numLeaving;
                    this.setState({
                      remoteList: this.state.remoteList,
                    });
                    this.state.remoteListPluginHandle[numLeaving].detach();
                    delete this.state.remoteListPluginHandle.numLeaving;
                  }
                } else if (
                  msg['error'] !== undefined &&
                  msg['error'] !== null
                ) {
                }
              }
            }
            if (jsep !== undefined && jsep !== null) {
              sfutest.handleRemoteJsep({
                jsep: jsep,
              });
              // sfutest.createAnswer({
              //   // We attach the remote OFFER
              //   jsep: jsep,
              //   // We want recvonly audio/video
              //   media: {audioSend: false, videoSend: false},
              //   success: function(ourjsep) {
              //     // Got our SDP! Send our ANSWER to the plugin
              //     // var body = {request: 'start'};
              //     // sfutest.send({
              //     //   message: body,
              //     //   jsep: ourjsep,
              //     // });
              //     sfutest.send({
              //       message: {
              //         request: 'accept',
              //       },
              //       jsep: jsep,
              //     });
              //   },
              //   error: function(error) {
              //     // An error occurred...
              //   },
              // });
            }
          },
          onlocalstream: stream => {
            this.setState({
              selfViewSrc: stream.toURL(),
            });
            this.setState({
              selfViewSrcKey: Math.floor(Math.random() * 1000),
            });
            this.setState({
              status: 'ready',
              info: 'Please enter or create room ID',
            });
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
        // Alert.alert("  Success for End Call ");
        this.setState({publish: false});
      },
    });
  };

  registerUsername() {
    console.log('❌❌❌❌❌❌❌❌❌register user name');

    var body = {
      request: 'register',
      username: 'chin',
    };
    sfutest.send({
      message: body,
    });
  }

  async callOffer() {
    console.log('🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟 call offer');

    var body = {
      request: 'call',
      username: 'hung',
    };
    sfutest.createOffer({
      media: {
        audioRecv: false,
        videoRecv: false,
        audioSend: true,
        videoSend: true,
        mandatory: {OfferToReceiveVideo: false, OfferToReceiveAudio: true},
      },
      success: jsep => {
        // console.log('🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🥇🚗🚗🚗🚗🚗');

        // Janus.debug(jsep);
        // console.log('Create offer : success \n');
        // console.log(jsep.type);

        sfutest.send({
          message: body,
          jsep: jsep,
        });
        // console.log('🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗');
      },
      error: error => {
        Alert.alert('WebRTC error:', error);
      },
    });
  }

  async acceptAnswer() {
    console.log('✅✅✅✅✅✅✅✅✅✅✅✅ accept answer');

    sfutest.createAnswer({
      media: {
        audioRecv: false,
        videoRecv: false,
        audioSend: true,
        videoSend: true,
        mandatory: {OfferToReceiveVideo: false, OfferToReceiveAudio: true},
      },
      success: jsep => {
        // console.log('Create offer : success \n');
        // var publish = {
        //   request: 'configure',
        //   audio: useAudio,
        //   video: true,
        //   bitrate: 5000 * 1024,
        // };
        var body = {
          request: 'accept',
        };
        sfutest.send({
          message: body,
          jsep: jsep,
        });
      },
      error: error => {
        Alert.alert('WebRTC error:', error);
        // if (useAudio) {
        //   this.publishOwnFeed(false);
        // } else {
        // }
      },
    });
  }

  onPressButton = () => {
    if (!this.state.publish) {
      this.janusStart();
    } else {
      this.unpublishOwnFeed();
    }
  };

  switchVideoType = () => {
    sfutest.changeLocalCamera();
  };

  toggleAudioMute = () => {
    // this.props.App.test();
    let muted = sfutest.isAudioMuted();
    if (muted) {
      sfutest.unmuteAudio();
      this.setState({audioMute: false});
    } else {
      sfutest.muteAudio();
      this.setState({audioMute: true});
    }
  };

  toggleVideoMute = () => {
    let muted = sfutest.isVideoMuted();
    if (muted) {
      this.setState({videoMute: false});
      sfutest.unmuteVideo();
    } else {
      this.setState({videoMute: true});
      sfutest.muteVideo();
    }
  };

  toggleSpeaker = () => {
    if (this.state.speaker) {
      this.setState({speaker: false});
      // InCallManager.setForceSpeakerphoneOn(false)
    } else {
      this.setState({speaker: true});
      // InCallManager.setForceSpeakerphoneOn(true)
    }
  };

  endCall = () => {
    janus.destroy();
  };

  publishOwnFeed(useAudio) {
    if (!this.state.publish) {
      this.setState({
        publish: true,
        buttonText: 'Stop',
      });

      sfutest.createOffer({
        media: {
          audioRecv: false,
          videoRecv: false,
          audioSend: useAudio,
          videoSend: true,
        },
        success: jsep => {
          console.log('Create offer : success \n');
          var publish = {
            request: 'configure',
            audio: useAudio,
            video: true,
            bitrate: 5000 * 1024,
          };
          sfutest.send({
            message: publish,
            jsep: jsep,
          });
        },
        error: error => {
          Alert.alert('WebRTC error:', error);
          if (useAudio) {
            this.publishOwnFeed(false);
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

  newRemoteFeed(id, display) {
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
            media: {
              audioSend: false,
              videoSend: false,
            },
            success: jsep => {
              var body = {
                request: 'start',
                room: roomId,
              };
              remoteFeed.send({
                message: body,
                jsep: jsep,
              });
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
        this.setState({info: 'One peer join!'});
        const remoteList = this.state.remoteList;
        const remoteListPluginHandle = this.state.remoteListPluginHandle;
        remoteList[id] = stream.toURL();
        remoteListPluginHandle[id] = remoteFeed;
        this.setState({
          remoteList: remoteList,
          remoteListPluginHandle: remoteListPluginHandle,
        });
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

  unpublishOwnFeed() {
    if (this.state.publish) {
      this.setState({
        buttonText: 'Start for Janus !!!',
      });
      let unpublish = {request: 'unpublish'};
      sfutest.send({message: unpublish});
      janus.destroy();
      this.setState({selfViewSrc: null});
    }
  }

  render() {
    return (
      <ScrollView style={styles.container}>
        <Text>{this.state.status}</Text>
        {this.state.incomingCall && (
          <TouchableOpacity onPress={this.acceptAnswer} underlayColor="white">
            <View style={styles.button}>
              <Text style={styles.buttonText}>Accept</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={this.onPressButton} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>{this.state.buttonText}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.registerUsername} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>Register Username</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.callOffer} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>Call</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.switchVideoType} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>Switch camera</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.toggleAudioMute} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>
              {this.state.audioMute ? 'audioMute' : 'not audioMute'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.toggleVideoMute} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>
              {this.state.videoMute ? 'videoMute' : 'not videoMute'}
            </Text>
          </View>
        </TouchableOpacity>

        {this.state.selfViewSrc && (
          <RTCView
            key={this.state.selfViewSrcKey}
            streamURL={this.state.selfViewSrc}
            style={{width: 350, height: 600}}
          />
        )}
        {this.state.remoteList &&
          Object.keys(this.state.remoteList).map((key, index) => {
            return (
              <RTCView
                key={Math.floor(Math.random() * 1000)}
                streamURL={this.state.remoteList[key]}
                style={styles.remoteView}
              />
            );
          })}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    // alignItems: 'center',
  },
  button: {
    marginBottom: 30,
    width: 260,
    alignItems: 'center',
    backgroundColor: '#2196F3',
  },
  buttonText: {
    padding: 20,
    color: 'white',
  },
});
