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

let host = '192.168.30.162';
let server = 'http://' + host + ':8088/janus';
// let backHost = 'http://' + host + ':3000/stream';

let globalJsep = null;

var janus = null;
var videocall = null;
var opaqueId = 'videocalltest-' + Janus.randomString(12);

var bitrateTimer = null;
var spinner = null;

var audioenabled = false;
var videoenabled = false;

var myusername = null;
var yourusername = null;

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
      remoteViewSrc: null,
      remoteViewSrcKey: null,
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
    this.toEnd.bind(this);
  }

  componentDidMount() {
    this.janusStart();
  }

  janusStart = () => {
    this.setState({visible: true});
    janus = new Janus({
      server: server,
      // iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
      success: () => {
        janus.attach({
          plugin: 'janus.plugin.videocall',
          opaqueId: opaqueId,
          success: pluginHandle => {
            videocall = pluginHandle;
            Janus.log(
              'Plugin attached! (' +
                videocall.getPlugin() +
                ', id=' +
                videocall.getId() +
                ')',
            );
          },
          error: error => {
            Janus.error('  -- Error attaching plugin...', error);
            Alert.alert('  -- Error attaching plugin...', error);
          },
          consentDialog: on => {
            Janus.debug(
              'Consent dialog should be ' + (on ? 'on' : 'off') + ' now',
            );
          },
          mediaState: (medium, on) => {
            Janus.log(
              'Janus ' +
                (on ? 'started' : 'stopped') +
                ' receiving our ' +
                medium,
            );
          },
          webrtcState: on => {
            Janus.log(
              'Janus says our WebRTC PeerConnection is ' +
                (on ? 'up' : 'down') +
                ' now',
            );
          },
          onmessage: (msg, jsep) => {
            Janus.debug(' ::: Got a message :::');
            Janus.debug(msg);
            var result = msg['result'];
            globalJsep = jsep;
            if (result !== undefined && result !== null) {
              if (result['list'] !== undefined && result['list'] !== null) {
                var list = result['list'];
                Janus.debug('Got a list of registered peers:');
                Janus.debug(list);
                for (var mp in list) {
                  Janus.debug('  >> [' + list[mp] + ']');
                }
              } else if (
                result['event'] !== undefined &&
                result['event'] !== null
              ) {
                var event = result['event'];
                if (event === 'registered') {
                  myusername = result['username'];
                  Janus.log('Successfully registered as ' + myusername + '!');
                  videocall.send({
                    message: {request: 'list'},
                  });
                } else if (event === 'calling') {
                  Janus.log('Waiting for the peer to answer...');
                  // TODO Any ringtone?
                  Alert.alert('Waiting for the peer to answer...');
                } else if (event === 'incomingcall') {
                  Janus.log('Incoming call from ' + result['username'] + '!');
                  yourusername = result['username'];

                  console.log('🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗');

                  // videocall.createAnswer({
                  //   jsep: jsep,
                  //   media: {data: true},
                  //   simulcast: false,
                  //   success: function(jsep1) {
                  //     Janus.debug('Got SDP!');
                  //     Janus.debug(jsep1);
                  //     var body = {
                  //       request: 'accept',
                  //     };
                  //     videocall.send({
                  //       message: body,
                  //       jsep: jsep1,
                  //     });
                  //   },
                  //   error: function(error) {
                  //     Janus.error('WebRTC error:', error);
                  //   },
                  // });
                  this.setState({incomingCall: true});
                  console.log('🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀');
                } else if (event === 'accepted') {
                  console.log('🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀');
                  var peer = result['username'];
                  if (peer === null || peer === undefined) {
                    Janus.log('Call started!');
                  } else {
                    Janus.log(peer + ' accepted the call!');
                    yourusername = peer;
                  }
                  // Video call can start
                  if (jsep) videocall.handleRemoteJsep({jsep: jsep});
                } else if (event === 'update') {
                  // An 'update' event may be used to provide renegotiation attempts
                  if (jsep) {
                    if (jsep.type === 'answer') {
                      videocall.handleRemoteJsep({jsep: jsep});
                    } else {
                      videocall.createAnswer({
                        jsep: jsep,
                        media: {data: true}, // Let's negotiate data channels as well
                        success: function(jsep) {
                          Janus.debug('Got SDP!');
                          Janus.debug(jsep);
                          var body = {request: 'set'};
                          videocall.send({
                            message: body,
                            jsep: jsep,
                          });
                        },
                        error: function(error) {
                          Janus.error('WebRTC error:', error);
                          Alert.alert(
                            'WebRTC error... ' + JSON.stringify(error),
                          );
                        },
                      });
                    }
                  }
                } else if (event === 'hangup') {
                  Janus.log(
                    'Call hung up by ' +
                      result['username'] +
                      ' (' +
                      result['reason'] +
                      ')!',
                  );
                  // Reset status
                  this.toEnd();
                }
              }
            } else {
              // FIXME Error?
              var error = msg['error'];
              Alert.alert(error);
              // TODO Reset status
              videocall.hangup();
            }
          },
          onlocalstream: stream => {
            console.log('🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓🏓', stream.toURL());
            Janus.debug(' ::: Got a local stream :::');
            Janus.debug(stream);

            this.setState({
              selfViewSrc: stream.toURL(),
              selfViewSrcKey: Math.floor(Math.random() * 1000) + 1,
              status: 'ready',
            });
          },
          onremotestream: stream => {
            console.log('🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩🧩', stream.toURL());
            Janus.debug(' ::: Got a remote stream :::');
            Janus.debug(stream);

            this.setState({
              remoteViewSrc: stream.toURL(),
              remoteViewSrcKey: Math.floor(Math.random() * 1000) + 2,
              status: 'connecting',
            });
          },
          ondataopen: function(data) {
            Janus.log('The DataChannel is available!');
          },
          ondata: function(data) {
            Janus.debug('We got data from the DataChannel! ' + data);
          },
          oncleanup: function() {
            Janus.log(' ::: Got a cleanup notification :::');
            yourusername = null;
          },
        });
      },
      error: error => {
        Janus.error('  Janus Error', error);
        Alert.alert('  Janus Error', error);
      },
      destroyed: () => {
        Alert.alert('  Success for End Call ');
        this.setState({publish: false});
      },
    });
  };

  registerUsername() {
    console.log('❌❌❌❌❌❌❌❌❌register user name');

    var register = {request: 'register', username: 'chin'};
    videocall.send({message: register});
  }

  doCall = () => {
    console.log('🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟🎟 call offer');

    // Call this user
    videocall.createOffer({
      media: {data: true}, // ... let's negotiate data channels as well
      success: function(jsep) {
        Janus.debug('Got SDP!');
        Janus.debug(jsep);
        var body = {request: 'call', username: 'hung'};
        videocall.send({message: body, jsep: jsep});
      },
      error: function(error) {
        Janus.error('WebRTC error...', error);
        Alert.alert('WebRTC error... ' + error);
      },
    });
  };

  doAccept = () => {
    console.log('✅✅✅✅✅✅✅✅✅✅✅✅ accept answer');

    videocall.createAnswer({
      jsep: globalJsep,
      media: {data: true},
      simulcast: false,
      success: function(jsep) {
        Janus.debug('Got SDP!');
        Janus.debug(jsep);
        var body = {
          request: 'accept',
        };
        videocall.send({
          message: body,
          jsep: jsep,
        });
      },
      error: function(error) {
        Janus.error('WebRTC error:', error);
      },
    });
  };

  switchVideoType = () => {
    videocall.changeLocalCamera();
  };

  toggleAudioMute = () => {
    let muted = videocall.isAudioMuted();
    if (muted) {
      videocall.unmuteAudio();
      this.setState({audioMute: false});
    } else {
      videocall.muteAudio();
      this.setState({audioMute: true});
    }
  };

  toggleVideoMute = () => {
    let muted = videocall.isVideoMuted();
    if (muted) {
      this.setState({videoMute: false});
      videocall.unmuteVideo();
    } else {
      this.setState({videoMute: true});
      videocall.muteVideo();
    }
  };

  toggleSpeaker = () => {
    if (this.state.speaker) {
      this.setState({speaker: false});
    } else {
      this.setState({speaker: true});
    }
  };

  doHangup = () => {
    var hangup = {request: 'hangup'};
    videocall.send({message: hangup});
    videocall.hangup();
    yourusername = null;
    this.setState({selfViewSrc: null, remoteViewSrc: null, status: 'hangup'});
  };

  render() {
    return (
      <ScrollView style={styles.container}>
        <Text>{this.state.status}</Text>
        {this.state.incomingCall && (
          <TouchableOpacity onPress={this.doAccept} underlayColor="white">
            <View style={styles.button}>
              <Text style={styles.buttonText}>Accept</Text>
            </View>
          </TouchableOpacity>
        )}
        {/* <TouchableOpacity onPress={this.onPressButton} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>{this.state.buttonText}</Text>
          </View>
        </TouchableOpacity> */}
        <TouchableOpacity onPress={this.registerUsername} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>Register Username</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.doCall} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>Call</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={this.doHangup} underlayColor="white">
          <View style={styles.button}>
            <Text style={styles.buttonText}>End</Text>
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
        {this.state.remoteViewSrc && (
          <RTCView
            key={this.state.remoteViewSrcKey}
            streamURL={this.state.remoteViewSrc}
            style={{width: 350, height: 600}}
          />
        )}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
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
