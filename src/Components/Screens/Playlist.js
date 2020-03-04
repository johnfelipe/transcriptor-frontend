import React, { useState, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton'; // (https://github.com/dvtng/react-loading-skeleton#readme)
import EventEmitter from 'event-emitter';
import hotkeys from 'hotkeys-js';
import $ from 'jquery';
import '../styles.css';

import { useDispatch, useSelector } from 'react-redux';
import { saveEventEmitter } from '../../actions/TranscriptionActions';

const WaveformPlaylist = require('waveform-playlist');
const axios = require('axios');

const Playlist = props => {
    const [playlistLoaded, setPlaylistLoaded] = useState(false);

    let dispatch = useDispatch();

    useEffect(() => {
        let playlist = WaveformPlaylist.init(
            {
                container: document.getElementById('waveform-playlist-container'),
                timescale: true,
                state: 'select',
                samplesPerPixel: 1024,
                colors: {
                    waveOutlineColor: 'white',
                    timeColor: 'grey',
                    fadeColor: 'black',
                },
                annotationList: {
                    annotations: props.notes,
                    controls: [],
                    editable: true,
                    isContinuousPlay: false,
                    linkEndpoints: true,
                },
                seekStyle: 'line',
                options: {
                    isAutomaticScroll: true,
                },
            },
            EventEmitter()
        );

        setTimeout(() => {
            playlist
                .load([
                    {
                        src: `${process.env.REACT_APP_API_HOST}/${props.fileInfo.path}`,
                    },
                ])
                .then(function() {
                    $('.playlist-toolbar').show();
                    $('#waveform-playlist-container').show();

                    setPlaylistLoaded(true);

                    let ee = playlist.getEventEmitter();
                    dispatch(saveEventEmitter(ee));

                    /* 
                        Elements
                    */
                    const $window = $(window);
                    const $playButton = $('.btn-play');
                    const $pauseButton = $('.btn-pause');
                    const $stopButton = $('.btn-stop');
                    const $waveform = $('.playlist-tracks')[0];
                    const $annotationsTextBox = document.getElementsByClassName('annotations-text')[0];
                    const $sentenceSectionBoxes = document.getElementsByClassName('annotation-box');
                    const $annotationsBoxesDiv = document.getElementsByClassName('annotations-boxes')[0];
                    const $cursor = document.getElementsByClassName('cursor')[0];
                    const $annotations = document.getElementsByClassName('annotation');
                    const $timeTicks = $('.time');

                    /* 
                        Time constants
                    */
                    const oneSecond = parseInt($timeTicks[1].style.left) / 2;

                    /* 
                        Unsubscribe to all event listeners
                    */
                    $waveform.removeEventListener('scroll', () => console.log('waveform scroll event removed'));
                    $annotationsTextBox.removeEventListener('click', () => console.log('sentence click listener removed'));
                    hotkeys.unbind('shift+down');
                    hotkeys.unbind('shift+up');
                    hotkeys.unbind('enter');

                    /* 
                        Utility functions
                    */

                    const removeHighlight = $element => {
                        $element.classList.remove('current');
                    };

                    const addHighlight = $element => {
                        console.log($element);
                        $element.classList.add('current');
                    };

                    const removeAllHighlights = () => {
                        for (let $annotation of $annotations) {
                            if ($annotation.classList.length > 1) {
                                $annotation.classList.remove('current');
                            }
                        }
                    };

                    const getCurrentHighlightedElement = () => {
                        for (let $annotation of $annotations) {
                            if ($annotation.classList.length > 1) {
                                return $annotation;
                            }
                        }
                        return null;
                    };

                    const getNextForHighlight = (scrollPoints, mode) => {
                        let len = $annotations.length;
                        for (let idx in $annotations) {
                            let id = parseInt(idx);
                            if (!isNaN(id)) {
                                if ($annotations[id].classList.length > 1) {
                                    /* 
                                        Auto scroll annotations container
                                    */
                                    let curr, next;
                                    if (mode === 'down') {
                                        curr = id;
                                        next = (id + 1) % len;

                                        if (next === 0) {
                                            $annotationsTextBox.scrollTo(0, 0);
                                        }
                                    } else {
                                        curr = id;
                                        next = (id - 1) % len;

                                        if (curr === 0) {
                                            let points = Array.from(scrollPoints.values());
                                            next = len - 1;
                                            $annotationsTextBox.scrollTo(0, points[points.length - 1]);
                                        }
                                    }

                                    if (scrollPoints.has(next)) {
                                        let scrollByVal = scrollPoints.get(next);

                                        $annotationsTextBox.scrollTo(0, scrollByVal);
                                    }
                                    removeHighlight($annotations[curr]);
                                    addHighlight($annotations[next]);
                                    return {
                                        mode: true,
                                        $prevSentenceNode: $annotations[curr],
                                    };
                                }
                            }
                        }
                        addHighlight($annotations[0]);
                        return {
                            mode: true,
                            $prevSentenceNode: null,
                        };
                    };

                    const timeStringToFloat = time => {
                        let [hours, minutes, seconds] = time.split(':').map(unit => parseFloat(unit));

                        let totalSeconds = hours * 3600 + minutes * 60 + seconds;

                        return totalSeconds;
                    };

                    const getSentenceInfo = $element => {
                        let sentenceId = $element.getElementsByClassName('annotation-id')[0].innerHTML;
                        let startTime = $element.getElementsByClassName('annotation-start')[0].innerHTML;
                        let endTime = $element.getElementsByClassName('annotation-end')[0].innerHTML;
                        let text = $element.getElementsByClassName('annotation-lines')[0].innerHTML;

                        startTime = timeStringToFloat(startTime);
                        endTime = timeStringToFloat(endTime);

                        return { sentenceId, startTime, endTime, text };
                    };

                    const getCursorStopPoint = () => {
                        let cursorPos = parseInt($cursor.style.left);
                        let stopTime = parseFloat(cursorPos / oneSecond);

                        return stopTime;
                    };

                    const diffExists = (sentenceId, newText) => {
                        const oldText = props.notes[sentenceId]['lines'];

                        return newText.length !== oldText.length;
                    };

                    const save = async $sentenceNode => {
                        const sentences = [];

                        if ($sentenceNode !== null) {
                            let { sentenceId, text } = getSentenceInfo($sentenceNode);

                            if (diffExists(sentenceId - 1, text)) {
                                sentences.push({
                                    sentenceId: props.notes[sentenceId - 1]['sentenceId'],
                                    text: text,
                                });
                            }
                        }

                        const URL = `${process.env.REACT_APP_API_HOST}/api/speech/${props._id}/transcripts`;
                        const token = localStorage.getItem('token');

                        const res = await axios({
                            method: 'PUT',
                            url: URL,
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                            data: {
                                sentences,
                            },
                        });

                        return res;
                    };

                    /* 
                        Actions on above Elements
                    */

                    $playButton.on('click', () => {
                        removeAllHighlights();

                        ee.emit('play');

                        let cursorLimit = $annotationsBoxesDiv.offsetWidth;

                        setInterval(() => {
                            if (parseInt($cursor.style.left) >= cursorLimit) {
                                $waveform.scrollTo(cursorLimit, 0);
                            }
                        }, 1000);
                    });

                    $pauseButton.on('click', () => {
                        ee.emit('pause');
                    });

                    $stopButton.on('click', () => {
                        removeAllHighlights();

                        $waveform.scrollTo(0, 0);

                        ee.emit('stop');
                    });

                    let prevScroll = 0;

                    $waveform.addEventListener('scroll', e => {
                        prevScroll = $waveform.scrollLeft;
                    });

                    $annotationsTextBox.addEventListener('click', e => {
                        removeAllHighlights();

                        let $currentClickedSentence = e.path[1];
                        let { sentenceId, startTime, endTime } = getSentenceInfo($currentClickedSentence);

                        let scrollVal = parseInt($sentenceSectionBoxes[sentenceId - 1].style.left);

                        $waveform.scrollTo(prevScroll + scrollVal, 0);

                        prevScroll += scrollVal;

                        /* 
                            Mouse click on sentence to play that section 
                            not needed for now!
                        */

                        // ee.emit('play', startTime, endTime);

                        addHighlight($currentClickedSentence);
                    });

                    /* 
                        Define keyboard shortcuts
                    */
                    let annotationsContainerHeight = $annotationsTextBox.offsetHeight > 320 ? 550 : 300;
                    let annotationBoxHeights = Array.from($annotations).map($annotation => $annotation.offsetHeight);
                    let scrollPoints = new Map();
                    let page = 1;

                    for (let i = 1; i < annotationBoxHeights.length; i++) {
                        annotationBoxHeights[i] += annotationBoxHeights[i - 1];
                        if (annotationBoxHeights[i] >= annotationsContainerHeight * page) {
                            scrollPoints.set(i, annotationBoxHeights[i - 1]);
                            page++;
                        }
                    }

                    let keyboardBoardMode = false;

                    hotkeys('shift+down', (e, handler) => {
                        const { mode, $prevSentenceNode } = getNextForHighlight(scrollPoints, 'down');
                        keyboardBoardMode = mode;
                        /* 
                            Call function to save edit here
                        */
                        save($prevSentenceNode).then(resp => {
                            console.log('saved!');
                        });

                        e.preventDefault();
                    });

                    hotkeys('shift+up', (e, handler) => {
                        const { mode, $prevSentenceNode } = getNextForHighlight(scrollPoints, 'up');
                        keyboardBoardMode = mode;
                        /* 
                            Call function to save edit here
                        */
                        save($prevSentenceNode).then(resp => {
                            console.log('saved!');
                        });

                        e.preventDefault();
                    });

                    hotkeys('enter', (e, handler) => {
                        let $currentHighlighted = getCurrentHighlightedElement();

                        let $currentAnnotationText = $currentHighlighted.getElementsByClassName('annotation-lines')[0];

                        /* Reason for timeout: https://stackoverflow.com/questions/15859113/focus-not-working */
                        setTimeout(() => $currentAnnotationText.focus(), 0);
                    });

                    let playMode = 'play';

                    hotkeys('shift+space', (e, handler) => {
                        if (keyboardBoardMode) {
                            let $currentHighlighted = getCurrentHighlightedElement();

                            let { sentenceId, startTime, endTime } = getSentenceInfo($currentHighlighted);

                            let setHighlighter = null;

                            let scrollVal = parseInt($sentenceSectionBoxes[sentenceId - 1].style.left);

                            $waveform.scrollTo(prevScroll + scrollVal, 0);

                            prevScroll += scrollVal;

                            if (playMode === 'pause') {
                                ee.emit('pause');
                                playMode = 'resume';
                                if (setHighlighter !== null) {
                                    clearTimeout(setHighlighter);
                                }
                                /* make sure highlight is added just after pause */
                                setTimeout(() => addHighlight($currentHighlighted), 10);
                            } else {
                                if (playMode === 'resume') {
                                    startTime = getCursorStopPoint();
                                    setHighlighter = setTimeout(() => addHighlight($currentHighlighted), (endTime - startTime + 0.01) * 1000);
                                }
                                ee.emit('play', startTime, endTime);
                                playMode = 'pause';
                            }
                        }
                    });
                });
        }, 500);
    }, []);

    const PLaylistGhostLoader = () => {
        const ListGhostLoader = props => {
            let ghostSentences = [];
            for (let i = 0; i < props.count; i++) {
                ghostSentences.push(
                    <li className="sentence-ghost" key={i}>
                        <Skeleton width={1000} height={50} />
                    </li>
                );
            }
            return ghostSentences;
        };

        return (
            <React.Fragment>
                <div className="toolbar-ghost">
                    <Skeleton width={400} height={35} />
                </div>
                <div className="waveform-ghost">
                    <Skeleton height={148} />
                </div>
                <ul className="sentence-ghost-container">
                    <ListGhostLoader count={10} />
                </ul>
            </React.Fragment>
        );
    };

    if (playlistLoaded) {
        return <React.Fragment></React.Fragment>;
    } else {
        return (
            <React.Fragment>
                <PLaylistGhostLoader />
            </React.Fragment>
        );
    }
};

export default Playlist;
