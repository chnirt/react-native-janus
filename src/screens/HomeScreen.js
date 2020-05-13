import React, {useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

const HomeScreen = () => {
  const [myusername, setMyusername] = useState('chin');
  const navigation = useNavigation();

  function _onPressButton() {
    navigation.navigate('Video', {myusername});
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={{
          height: 40,
          width: 260,
          backgroundColor: '#fff',
          borderRadius: 5,
          padding: 10,
          marginBottom: 30,
        }}
        placeholder="Your username?"
        onChangeText={text => setMyusername(text)}
        defaultValue={myusername}
      />
      <TouchableOpacity onPress={_onPressButton}>
        <View style={styles.button}>
          <Text style={styles.buttonText}>Join call</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    marginBottom: 30,
    width: 260,
    alignItems: 'center',
    backgroundColor: '#59822c',
  },
  buttonText: {
    textAlign: 'center',
    padding: 20,
    color: 'white',
  },
});
