import React, { useState, useEffect } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';
import { useToasts } from 'react-toast-notifications';
import $ from 'jquery';

// Also check : https://medium.com/@bryanjenningz/how-to-record-and-play-audio-in-javascript-faa1b2b3e49b

const recorder = new MicRecorder({ bitRate: 128 });

const SortableCard = ({ data: item, callbacks }) => {
    const [recording, setRecording] = useState(false);
    const { addToast } = useToasts();

    useEffect(() => {
        $(`#${item.id}`).blur(function() {
            callbacks.changeDisplayName(item.id, this.innerText);
        });

        return () => {
            $(`#${item.id}`).unbind();
        };
    }, []);

    const setGlobalFlag = type => {
        /* 
            type : recording | play_audio

            Acts as mutex lock for recording and listening 
            only one segement at the same time.
        */
        localStorage.setItem(`global_${type}_flag`, 'true');
    };

    const unSetGlobalFlag = type => {
        /* 
            type : recording | play_audio
        */
        localStorage.removeItem(`global_${type}_flag`);
    };

    const getGlobalFlagStatus = type => {
        if (localStorage.getItem(`global_${type}_flag`)) return true;

        return false;
    };

    const notify = (message, type) => {
        /* 
            type: error | warning | success
        */
        addToast(message, {
            autoDismiss: true,
            appearance: type,
            autoDismissTimeout: 3000,
        });
    };

    const startRecording = () => {
        recorder
            .start()
            .then(() => {
                setRecording(true);
                setGlobalFlag('recording');
            })
            .catch(e => console.error(e));
    };

    const stopRecording = () => {
        recorder
            .stop()
            .getMp3()
            .then(([buffer, blob]) => {
                setRecording(false);
                unSetGlobalFlag('recording');
                callbacks.saveSegment(item.id, blob);
            })
            .catch(e => console.log(e));
    };

    const handleDelete = () => {
        if (recording) {
            stopRecording();
        }
        callbacks.deleteSegment(item.id);
    };

    const playAudio = e => {
        if (!getGlobalFlagStatus('recording') && !getGlobalFlagStatus('play_audio')) {
            localStorage.setItem('currently_playing', item.id);
            callbacks.playSegment(item.id, e.target);
        } else {
            if (getGlobalFlagStatus('recording')) {
                notify('Cannot play and record at the same time!', 'error');
            } else if (getGlobalFlagStatus('play_audio')) {
                notify('Cannot play two segments at the same time!', 'error');
            }
        }
    };

    const handleRecording = () => {
        /*
            Recording === true meaning currently segment 
            is being recorded
        */
        if (!recording) {
            if (!getGlobalFlagStatus('recording') && !getGlobalFlagStatus('play_audio')) {
                startRecording();
            } else {
                if (getGlobalFlagStatus('recording')) {
                    notify('Cannot record two segments at the same time!', 'error');
                } else if (getGlobalFlagStatus('play_audio')) {
                    notify('Cannot record when segment is playing!', 'error');
                }
            }
        } else {
            stopRecording();
        }
    };

    const stringTimeFormat = (h, m, s) => {
        let time = '';

        if (h > 0) time += h.toString() + 'h ';

        if (m > 0) time += m.toString() + 'm ';

        if (s >= 0) time += s.toString() + 's';

        return time;
    };

    const timeFormat = time => {
        /* 
            Inputs time in seconds format to h/m/s
            
            Ex: 337.2s -> 5m 37.2s
                3601.4s -> 1h 1.4s
        */
        time = parseFloat(time);

        let h = 0,
            m = 0,
            s = 0;
        h = parseInt(time / 3600);
        time = time - h * 3600;
        m = parseInt(time / 60);
        time = time - m * 60;
        s = Math.round(time * 10) / 10; // converting to one decimal place

        return stringTimeFormat(h, m, s);
    };

    return (
        <div className="sortable-list" key={item.id}>
            {item.duration && (
                <span id={`time-label-${item.id}`} className="time-label">
                    {timeFormat(item.duration)}
                </span>
            )}
            <div className="sortable-filename">
                <span contenteditable="true" id={item.id} className="sortable-display-name">
                    {item.displayName}
                </span>
            </div>
            <div className="sortable-listen-icon" onClick={playAudio}>
                <i className="fas fa-volume-up"></i>
            </div>
            <div className="sortable-record-icon" onClick={handleRecording}>
                <i className={`fas fa-microphone ${recording ? `recording` : ``}`}></i>
            </div>
            <div className="sortable-delete-icon" onClick={handleDelete}>
                <i className="fas fa-times"></i>
            </div>
        </div>
    );
};

export default SortableCard;
