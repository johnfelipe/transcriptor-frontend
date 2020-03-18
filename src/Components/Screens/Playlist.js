/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton'; // (https://github.com/dvtng/react-loading-skeleton#readme)
import EventEmitter from 'event-emitter';
import hotkeys from 'hotkeys-js';
import $ from 'jquery';
import '../styles.css';

import { useDispatch, useSelector } from 'react-redux';
import { saveEventEmitter, toggleSaveMode, releaseToast } from '../../actions/TranscriptionActions';
import { useToasts } from 'react-toast-notifications';

const WaveformPlaylist = require('waveform-playlist');
const hasListeners = require('event-emitter/has-listeners');
const axios = require('axios');

const Playlist = props => {
    const [playlistLoaded, setPlaylistLoaded] = useState(false);

    const { inSaveMode, toast } = useSelector(state => ({ ...state.TRANSCRIPTION }));

    const dispatch = useDispatch();
    const { addToast, removeToast } = useToasts();

    useEffect(() => {
        if (toast != null) {
            const { content, ...toastProps } = toast;
            addToast(content, { autoDismiss: true, ...toastProps });

            dispatch(releaseToast(null));
        }
    }, [toast]);

    let cachedSamplesPerPixel =
        2000 -
        (JSON.parse(localStorage.getItem('editorState'))
            ? JSON.parse(localStorage.getItem('editorState')).zoomLevel
            : 1000);

    useEffect(() => {
        let playlist = WaveformPlaylist.init(
            {
                container: document.getElementById('waveform-playlist-container'),
                timescale: true,
                state: 'select',
                colors: {
                    waveOutlineColor: 'white',
                    timeColor: 'grey',
                    fadeColor: 'black',
                },
                annotationList: {
                    annotations: props.notes,
                    controls: props.actions,
                    editable: true,
                    isContinuousPlay: false,
                    linkEndpoints: true,
                },
                seekStyle: 'line',
                samplesPerPixel: cachedSamplesPerPixel,
                waveHeight: 100,
                zoomLevels: [200, 300, 400, 500, 1000, 1500, 1600, 1700, 1800],
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
                        setInterval objects
                    */
                    let cursorUpdate = null;
                    let autoSave = null;

                    /* 
                        Elements & Variables
                    */
                    const $zoomOut = $('.btn-zoom-out');
                    const $zoomIn = $('.btn-zoom-in');
                    const $waveform = $('.playlist-tracks')[0];
                    const $annotationsTextBoxContainer = document.getElementsByClassName('annotations-text')[0];
                    const $sentenceSectionBoxes = document.getElementsByClassName('annotation-box');
                    const $annotationsBoxesDiv = document.getElementsByClassName('annotations-boxes')[0];
                    const $annotationsTextBoxes = document.getElementsByClassName('annotation-lines');
                    const $cursor = document.getElementsByClassName('cursor')[0];
                    const $waveformTrack = document.getElementsByClassName('waveform')[0];
                    const $selectionPoint = document.getElementsByClassName('point')[0];
                    let $annotations = document.getElementsByClassName('annotation'); // will change on delete
                    const $timeTicks = Array.from(document.getElementsByClassName('time'));
                    const $sentenceDeleteCrosses = $annotationsTextBoxContainer.getElementsByClassName('fa-times');

                    let notesCache = props.notes;
                    let prevScroll = 0;
                    let zoomLevels = [200, 300, 400, 500, 1000, 1500, 1600, 1700, 1800];
                    let cachedZoomLevel = JSON.parse(localStorage.getItem('editorState'))
                        ? JSON.parse(localStorage.getItem('editorState')).zoomLevel
                        : 1000;
                    let currZoomLevel = zoomLevels.indexOf(cachedZoomLevel);
                    let annotationsMap = new Map();

                    let annotationsContainerHeight =
                        $annotationsTextBoxContainer && $annotationsTextBoxContainer.offsetHeight > 320 ? 550 : 300;
                    let annotationBoxHeights = Array.from($annotations).map($annotation => $annotation.offsetHeight);
                    let scrollPoints = new Set();
                    let sentenceIdOnCursor = 0;
                    let cursorLimit = $annotationsBoxesDiv && $annotationsBoxesDiv.offsetWidth;
                    let playMode = 'play';
                    let sentenceFocus = false;

                    for (let i = 1; i < annotationBoxHeights.length; i++) {
                        annotationBoxHeights[i] += annotationBoxHeights[i - 1];
                    }

                    /*
                        Time related vars and methods
                    */

                    const timeStringToFloat = time => {
                        let [hours, minutes, seconds] = time.split(':').map(unit => parseFloat(unit));

                        let totalSeconds = hours * 3600 + minutes * 60 + seconds;

                        return totalSeconds;
                    };

                    const unitTimeOfMeasure = () => {
                        return (
                            $timeTicks &&
                            timeStringToFloat('00:' + $timeTicks[1].innerText) -
                                timeStringToFloat('00:' + $timeTicks[0].innerText)
                        );
                    };

                    let unitTime = null;

                    const oneSecondinPx = () => {
                        unitTime = unitTimeOfMeasure();
                        return (
                            $timeTicks &&
                            (parseInt($timeTicks[1].style.left) - parseInt($timeTicks[0].style.left)) / unitTime
                        );
                    };

                    let oneSecond = oneSecondinPx();

                    /* 
                        Unsubscribe to all event listeners
                    */
                    $waveform.removeEventListener('scroll', () => console.log('rmd'));
                    $annotationsTextBoxContainer.removeEventListener('click', () => console.log('rmd'));
                    Array.from($annotationsTextBoxes).map($annotationsTextBox => {
                        $annotationsTextBox.removeEventListener('keydown', () => console.log('rmd'));
                        $annotationsTextBox.removeEventListener('click', () => console.log('rmd'));
                    });
                    Array.from($sentenceSectionBoxes).map($sentenceBox => {
                        $sentenceBox.removeEventListener('click', () => console.log('rmd'));
                    });
                    hotkeys.unbind('down');
                    hotkeys.unbind('up');
                    hotkeys.unbind('enter');
                    hotkeys.unbind('ctrl+p');
                    clearInterval(autoSave);
                    clearInterval(cursorUpdate);

                    /* 
                        Utility functions
                    */
                    const updateAnnotationBoxHeights = () => {
                        annotationBoxHeights = Array.from($annotations).map($annotation => $annotation.offsetHeight);

                        for (let i = 1; i < annotationBoxHeights.length; i++) {
                            annotationBoxHeights[i] += annotationBoxHeights[i - 1];
                        }
                    };

                    const updateAnnotations = () => {
                        $annotations = document.getElementsByClassName('annotation');

                        updateAnnotationBoxHeights();
                    };

                    const removeSentenceHighlight = $element => {
                        $element.classList.remove('current');
                    };

                    const addSentenceHighlight = $element => {
                        $element.classList.add('current');
                    };

                    const removeAllSentenceHighlights = () => {
                        Array.from($annotations).map($e => $e.classList.remove('current'));
                    };

                    const addSectionHighlight = $element => {
                        $element.classList.add('section-highlight');
                    };

                    const removeSectionHighlight = $element => {
                        $element.classList.remove('section-highlight');
                    };

                    const removeAllSectionHighlights = () => {
                        Array.from($sentenceSectionBoxes).map($e => $e.classList.remove('section-highlight'));
                    };

                    const removeAllHighlights = () => {
                        Array.from($annotations).map($e => $e.classList.remove('current'));
                        Array.from($sentenceSectionBoxes).map($e => $e.classList.remove('section-highlight'));
                    };

                    const getCurrentHighlightedElement = () => {
                        for (let $annotation of $annotations) {
                            if ($annotation.classList.length > 1) {
                                return $annotation;
                            }
                        }
                        return null;
                    };

                    const lower_bound = (target, list) => {
                        let l = 0,
                            r = list.length;

                        while (l < r) {
                            const mid = parseInt((l + r) / 2);

                            if (list[mid] >= target) {
                                r = mid;
                            } else {
                                l = mid + 1;
                            }
                        }

                        return l;
                    };

                    const calcSentenceScrollEndPoints = () => {
                        const annotationsContainerScrollTop = $annotationsTextBoxContainer.scrollTop;

                        let topSentenceId = lower_bound(annotationsContainerScrollTop, annotationBoxHeights);

                        if (annotationBoxHeights[topSentenceId] === annotationsContainerHeight) {
                            topSentenceId += 1;
                        }

                        let bottomSentenceId = lower_bound(
                            annotationBoxHeights[topSentenceId] + annotationsContainerHeight,
                            annotationBoxHeights
                        );

                        scrollPoints.clear();
                        scrollPoints.add(topSentenceId);
                        scrollPoints.add(bottomSentenceId);
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
                                            $annotationsTextBoxContainer.scrollTo(0, 0);
                                        } else {
                                            if (scrollPoints.has(next)) {
                                                let scrollByVal = annotationBoxHeights[curr];

                                                $annotationsTextBoxContainer.scrollTo(0, scrollByVal);
                                            }
                                        }
                                    } else {
                                        curr = id;
                                        next = (id - 1) % len;

                                        if (curr === 0) {
                                            let scrollByVal = annotationBoxHeights[len - 1];
                                            next = len - 1;
                                            $annotationsTextBoxContainer.scrollTo(0, scrollByVal);
                                        } else {
                                            if (scrollPoints.has(next)) {
                                                let scrollByVal = annotationBoxHeights[next - 1];

                                                $annotationsTextBoxContainer.scrollTo(0, scrollByVal);
                                            }
                                        }
                                    }

                                    removeSentenceHighlight($annotations[curr]);
                                    addSentenceHighlight($annotations[next]);
                                    return {
                                        $prevSentenceNode: $annotations[curr],
                                    };
                                }
                            }
                        }
                        addSentenceHighlight($annotations[0]);
                        return {
                            $prevSentenceNode: null,
                        };
                    };

                    const getSentenceInfo = $element => {
                        if ($element) {
                            let sentenceId = $element.getElementsByClassName('annotation-id')[0].innerText;
                            let startTime = $element.getElementsByClassName('annotation-start')[0].innerText;
                            let endTime = $element.getElementsByClassName('annotation-end')[0].innerText;
                            let text = $element.getElementsByClassName('annotation-lines')[0].innerText.trim();

                            startTime = timeStringToFloat(startTime);
                            endTime = timeStringToFloat(endTime);

                            return { sentenceId, startTime, endTime, text };
                        }
                        return null;
                    };

                    const getCursorPosition = () => {
                        let cursorPos = parseInt($cursor.style.left);
                        let stopTime = parseFloat(cursorPos / oneSecond);

                        return stopTime;
                    };

                    const moveCursor = offsetSeconds => {
                        let cursorPos = parseInt($cursor.style.left);
                        let offset = offsetSeconds * oneSecond;

                        cursorPos += offset;

                        $cursor.style.left = cursorPos.toString() + 'px';
                    };

                    const setCursor = time => {
                        let offset = time * oneSecond;

                        $cursor.style.left = offset.toString() + 'px';
                    };

                    const diffTimes = (oldTime, newTime) => oldTime !== newTime;

                    const getSentenceTimeInfo = ($sentence, sentenceId) => {
                        const { startTime: newStartTime, endTime: newEndTime } = getSentenceInfo($sentence);

                        const oldStartTime = parseFloat(notesCache[sentenceId]['begin']);
                        const oldEndTime = parseFloat(notesCache[sentenceId]['end']);

                        return { newStartTime, newEndTime, oldStartTime, oldEndTime };
                    };

                    const diffExists = (sentenceId, newText, currNewStartTime, currNewEndTime) => {
                        const oldText = notesCache[sentenceId]['lines'].trim();

                        const currOldStartTime = parseFloat(notesCache[sentenceId]['begin']);
                        const currOldEndTime = parseFloat(notesCache[sentenceId]['end']);

                        const currStartTimeChanged = diffTimes(currOldStartTime, currNewStartTime);
                        const currEndTimeChanged = diffTimes(currOldEndTime, currNewEndTime);

                        let textChanged = false;

                        if (currStartTimeChanged) {
                            notesCache[sentenceId]['begin'] = currNewStartTime.toString();
                        }
                        if (currEndTimeChanged) {
                            notesCache[sentenceId]['end'] = currNewEndTime.toString();
                        }
                        if (newText.length !== oldText.length || newText !== oldText) {
                            notesCache[sentenceId]['lines'] = newText.trim();

                            textChanged = true;
                        }

                        return {
                            currStartTimeChanged,
                            currEndTimeChanged,
                            textChanged,
                        };
                    };

                    const save = async $sentenceNode => {
                        const sentences = [];

                        if ($sentenceNode !== null) {
                            let { sentenceId, text, startTime, endTime } = getSentenceInfo($sentenceNode);

                            sentenceId -= 1; // convert to zero based indexing

                            const { currStartTimeChanged, currEndTimeChanged, textChanged } = diffExists(
                                sentenceId,
                                text,
                                startTime,
                                endTime
                            );

                            if (currStartTimeChanged || currEndTimeChanged || textChanged) {
                                dispatch(toggleSaveMode(true));

                                if (sentenceId === 0 && $annotations[sentenceId + 1] && props.notes[sentenceId + 1]) {
                                    let { text, startTime, endTime } = getSentenceInfo($annotations[sentenceId + 1]);
                                    sentences.push({
                                        sentenceId: props.notes[sentenceId + 1]['sentenceId'],
                                        text,
                                        startTime,
                                        endTime,
                                    });
                                } else if (
                                    sentenceId === $annotations.length - 1 &&
                                    $annotations[sentenceId - 1] &&
                                    props.notes[sentenceId - 1]
                                ) {
                                    let { text, startTime, endTime } = getSentenceInfo($annotations[sentenceId - 1]);
                                    sentences.push({
                                        sentenceId: props.notes[sentenceId - 1]['sentenceId'],
                                        text,
                                        startTime,
                                        endTime,
                                    });
                                } else {
                                    if ($annotations[sentenceId + 1] && $annotations[sentenceId - 1]) {
                                        let { sentenceId: prevId, ...prevSentenceData } = getSentenceInfo(
                                            $annotations[sentenceId + 1]
                                        );
                                        sentences.push({
                                            sentenceId: props.notes[sentenceId + 1]['sentenceId'],
                                            ...prevSentenceData,
                                        });

                                        let { sentenceId: nextId, ...nextSentenceData } = getSentenceInfo(
                                            $annotations[sentenceId - 1]
                                        );
                                        sentences.push({
                                            sentenceId: props.notes[sentenceId - 1]['sentenceId'],
                                            ...nextSentenceData,
                                        });
                                    }
                                }

                                sentences.push({
                                    sentenceId: props.notes[sentenceId]['sentenceId'],
                                    text,
                                    startTime,
                                    endTime,
                                });

                                const URL = `${process.env.REACT_APP_API_HOST}/api/speech/${props._id}/transcripts`;
                                const token = localStorage.getItem('token');

                                const res = await axios({
                                    method: 'PUT',
                                    url: URL,
                                    mode: 'cors',
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                    data: {
                                        sentences,
                                    },
                                });

                                return res;
                            }
                        }
                        return null;
                    };

                    const scrollToSection = sentenceId => {
                        addSectionHighlight($sentenceSectionBoxes[sentenceId - 1]);

                        let scrollVal = parseInt($sentenceSectionBoxes[sentenceId - 1].style.left) - 20;

                        $waveform.scrollTo(prevScroll + scrollVal, 0);

                        prevScroll += scrollVal;
                    };

                    const scrollToSentence = sentenceId => {
                        $annotationsTextBoxContainer.scrollTo(0, annotationBoxHeights[sentenceId - 1]);
                    };

                    const cue = (mode = 'normal') => {
                        let $currentHighlighted = getCurrentHighlightedElement();

                        const initialCursorPoint = getCursorPosition();

                        if ($currentHighlighted !== null && sentenceFocus) {
                            let { startTime, endTime } = getSentenceInfo($currentHighlighted);

                            let setHighlighter = null;

                            if (initialCursorPoint > startTime && mode === 'normal') {
                                startTime = initialCursorPoint;
                            }

                            if (playMode === 'pause') {
                                ee.emit('pause');
                                playMode = 'resume';
                                if (setHighlighter !== null) {
                                    clearTimeout(setHighlighter);
                                }
                            } else {
                                if (playMode === 'resume') {
                                    startTime = getCursorPosition();
                                    setHighlighter = setTimeout(
                                        () => addSentenceHighlight($currentHighlighted),
                                        (endTime - startTime + 0.01) * 1000
                                    );
                                }
                                ee.emit('play', startTime, endTime);
                                playMode = 'pause';
                            }
                            /* make sure highlight is added just after pause / resume */
                            setTimeout(() => addSentenceHighlight($currentHighlighted), 10);
                        } else {
                            if (playMode === 'play') {
                                removeAllSectionHighlights();

                                ee.emit('play', initialCursorPoint);
                                playMode = 'pause';
                            } else if (playMode === 'pause') {
                                ee.emit('pause');
                                playMode = 'play';
                            }
                        }
                    };

                    const findSentence = time => {
                        for (let $annotation of $annotations) {
                            let { sentenceId, startTime, endTime } = getSentenceInfo($annotation);

                            if (time >= startTime && time < endTime) {
                                return {
                                    $currSentence: $annotation,
                                    sentenceId,
                                };
                            }
                        }
                        return {};
                    };

                    autoSave = setInterval(() => {
                        let $currentHighlighted = getCurrentHighlightedElement();
                        if (!inSaveMode) {
                            save($currentHighlighted).then(resp => {
                                if (resp !== null) {
                                    console.log('Auto saved!');
                                    setTimeout(() => dispatch(toggleSaveMode(false)), 1000);
                                }
                            });
                        }
                    }, 500);

                    cursorUpdate = setInterval(() => {
                        if (!sentenceFocus) {
                            let cursorPos = getCursorPosition();

                            /* 
                                playMode denotes the next possible 
                                state of the player. If playMode is 'pause' 
                                it is currently playing the track.
                            */
                            if (playMode === 'pause') {
                                let relativeFirstTick = parseInt($timeTicks[0].style.left);
                                let relativeFirstTickTime = timeStringToFloat('00:' + $timeTicks[0].innerText);

                                let cursorPosFromStart =
                                    relativeFirstTick + (cursorPos - relativeFirstTickTime) * oneSecond;

                                if (cursorPosFromStart >= cursorLimit) {
                                    $waveform.scrollTo(prevScroll + cursorLimit, 0);
                                }
                            }

                            let { $currSentence, sentenceId } = findSentence(cursorPos);

                            sentenceIdOnCursor = sentenceId;

                            removeAllSentenceHighlights();

                            $currSentence && addSentenceHighlight($currSentence);
                        }
                    }, 1000);

                    const updateEditorState = () => {
                        let $currentHighlighted = getCurrentHighlightedElement();
                        let sentenceId = null;

                        if ($currentHighlighted) {
                            sentenceId = getSentenceInfo($currentHighlighted).sentenceId;
                        }

                        let currEditorState = {
                            waveFormScroll: $waveform.scrollLeft,
                            annotationsContainerScroll: $annotationsTextBoxContainer.scrollTop,
                            cursorPos: $cursor.style.left,
                            currentHighlightedSentenceId: sentenceId,
                            sentenceInFocus: sentenceFocus,
                            zoomLevel: zoomLevels[currZoomLevel],
                        };
                        localStorage.setItem('editorState', JSON.stringify(currEditorState));
                    };

                    const loadEditorState = () => {
                        let prevState = JSON.parse(localStorage.getItem('editorState'));

                        if (prevState) {
                            $waveform.scrollTo(prevState.waveFormScroll, 0);
                            $annotationsTextBoxContainer.scrollTo(0, prevState.annotationsContainerScroll);
                            $cursor.style.left = prevState.cursorPos;

                            let sentenceId = prevState.currentHighlightedSentenceId;

                            sentenceId && addSentenceHighlight($annotations[sentenceId - 1]);
                            sentenceFocus = prevState.sentenceInFocus;
                            const prevZoomLevel = prevState.zoomLevel;
                            currZoomLevel = zoomLevels.indexOf(prevZoomLevel);

                            if (sentenceFocus) {
                                let $currentAnnotationText = $annotations[sentenceId - 1].getElementsByClassName(
                                    'annotation-lines'
                                )[0];

                                setTimeout(() => $currentAnnotationText.focus(), 0);
                                addSectionHighlight($sentenceSectionBoxes[sentenceId - 1]);
                            }

                            localStorage.setItem('loadSavedState', 'false');
                        }
                    };

                    const deleteSentence = async sentence_id => {
                        const URL = `${process.env.REACT_APP_API_HOST}/api/speech/${props._id}/transcripts/delete`;
                        const token = localStorage.getItem('token');

                        const res = await axios({
                            method: 'POST',
                            url: URL,
                            mode: 'cors',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                            data: {
                                sentences: [sentence_id],
                            },
                        });

                        return res;
                    };

                    /* 
                        Playlist initialization method calls
                        and calculations done here
                    */
                    calcSentenceScrollEndPoints(); // init scroll points
                    localStorage.getItem('loadSavedState') === 'true' && loadEditorState(); // load prev state from localStorage

                    /* 
                        Events
                    */
                    $zoomIn.on('click', e => {
                        ee.emit('zoomin');
                        currZoomLevel = Math.min(zoomLevels.length - 1, currZoomLevel + 1);
                        setTimeout(() => (oneSecond = oneSecondinPx()), 100);

                        console.log('curr int ', currZoomLevel);

                        updateEditorState();
                    });

                    $zoomOut.on('click', e => {
                        ee.emit('zoomout');
                        currZoomLevel = Math.max(0, currZoomLevel - 1);
                        setTimeout(() => (oneSecond = oneSecondinPx()), 100);

                        console.log('curr out ', currZoomLevel);

                        updateEditorState();
                    });

                    $waveform.addEventListener('scroll', e => {
                        prevScroll = $waveform.scrollLeft;

                        updateEditorState();
                    });

                    for (let $annotationTextBox of $annotationsTextBoxes) {
                        /* 
                            Play audio when focused into edit mode
                            on a sentence

                            CTRL + p
                        */
                        $annotationTextBox.addEventListener('keydown', e => {
                            if (e.ctrlKey && e.keyCode === 80) {
                                cue('normal');

                                updateEditorState();
                            }
                        });

                        /* 
                            Restart audio play when focused into edit mode
                            on a sentence

                            CTRL + b
                        */
                        $annotationTextBox.addEventListener('keydown', e => {
                            if (e.ctrlKey && e.keyCode === 66) {
                                playMode = 'play';

                                cue('restart');

                                updateEditorState();
                            }
                        });

                        /* 
                            Plus 0.1s to track

                            CTRL + plus
                        */
                        $annotationTextBox.addEventListener('keydown', e => {
                            if (e.ctrlKey && e.keyCode === 187) {
                                e.preventDefault();

                                moveCursor(0.1);

                                updateEditorState();
                            }
                        });

                        /* 
                            Minus 0.1s to track

                            CTRL + minus
                        */
                        $annotationTextBox.addEventListener('keydown', e => {
                            if (e.ctrlKey && e.keyCode === 189) {
                                e.preventDefault();

                                moveCursor(-0.1);

                                updateEditorState();
                            }
                        });

                        /* 
                            Prevent page refresh on ctrl+r and command+r
                        */
                        $annotationTextBox.addEventListener('keydown', e => {
                            if (e.ctrlKey && e.keyCode === 82) {
                                // ctrl + r
                                e.preventDefault();
                            }
                        });

                        $annotationTextBox.addEventListener('keydown', e => {
                            if (e.metaKey && e.keyCode === 82) {
                                // command + r
                                e.preventDefault();
                            }
                        });

                        /* 
                            Press enter to move out of focus 
                            after editing sentence
                        */
                        $annotationTextBox.addEventListener('keydown', e => {
                            if (e.keyCode === 13) {
                                e.preventDefault();

                                let $currentHighlighted = getCurrentHighlightedElement();
                                let $currentAnnotationText = $currentHighlighted.getElementsByClassName(
                                    'annotation-lines'
                                )[0];

                                let { startTime } = getSentenceInfo($currentHighlighted);

                                sentenceFocus = false;
                                removeAllSectionHighlights();
                                setCursor(startTime + 0.2);

                                $currentAnnotationText.blur();
                                addSentenceHighlight($currentHighlighted);

                                updateEditorState();
                            }
                        });

                        /* 
                           Click to select sentence and scroll to 
                           corresponding section on the waveform
                        */
                        $annotationTextBox.addEventListener('click', e => {
                            ee.emit('stop');
                            playMode = 'play';
                            sentenceFocus = true;

                            removeAllHighlights();

                            let $currentClickedSentence = e.path[1];
                            let { sentenceId, startTime } = getSentenceInfo($currentClickedSentence);

                            scrollToSection(sentenceId);
                            setCursor(startTime + 0.2);

                            addSentenceHighlight($currentClickedSentence);

                            updateEditorState();
                        });
                    }

                    /* 
                        Events handling interactions with 
                        the section box 
                    */
                    for (let $sectionBox of $sentenceSectionBoxes) {
                        $sectionBox.addEventListener('click', e => {
                            e.preventDefault();

                            removeAllHighlights();
                            const sentenceId = parseInt(e.srcElement.innerText) - 1;
                            let $currentElement = $annotations[sentenceId];

                            playMode = 'pause';

                            if ($currentElement) {
                                let { startTime, endTime } = getSentenceInfo($currentElement);

                                scrollToSentence(sentenceId);

                                setTimeout(() => {
                                    setCursor(startTime + 0.2);
                                    addSentenceHighlight($currentElement);
                                }, (endTime - startTime + 0.1) * 1000);
                            }

                            updateEditorState();
                        });

                        /* 
                            When user only changes section times without ever
                            going to any sentence
                        */
                        $sectionBox.addEventListener('dragend', e => {
                            let $currentHighlighted = getCurrentHighlightedElement();

                            if ($currentHighlighted === null) {
                                let sentenceId = parseInt(e.path[1].getAttribute('data-id'));
                                $currentHighlighted = $annotations[sentenceId - 1];

                                save($currentHighlighted).then(res => {
                                    console.log('saved section times!');
                                    setTimeout(() => dispatch(toggleSaveMode(false)), 1000);
                                });
                            }
                        });
                    }

                    /* 
                        Handling delete sentence
                    */
                    let undoQueue = [];

                    for (let $sentenceDeleteCross of $sentenceDeleteCrosses) {
                        $sentenceDeleteCross.addEventListener('click', e => {
                            const $sentence = e.path[2];

                            const { sentenceId } = getSentenceInfo($sentence);
                            const sentence_id = props.notes.filter(each => each.id === sentenceId)[0].sentenceId;

                            // delete() and add toast saying ctrl + z to undo

                            const $sentencesContainer = e.path[3];

                            const $sentenceSectionBox = $annotationsBoxesDiv.querySelector(
                                `div[data-id='${sentenceId}']`
                            );

                            $sentencesContainer.removeChild($sentence);
                            $sentenceSectionBox.style.display = 'none';

                            updateAnnotations();

                            dispatch(
                                releaseToast({
                                    id: sentenceId,
                                    content: 'Press CTRL + Z to undo delete',
                                    appearance: 'info',
                                    autoDismissTimeout: 500000,
                                })
                            );

                            let undoTimeout = setTimeout(() => {
                                deleteSentence(sentence_id).then(res => {
                                    if (res.data.success) {
                                        console.log('Sentence deleted on server!');
                                    }
                                });
                            }, 500000);

                            undoQueue.push({
                                $sentence,
                                $parent: $sentencesContainer,
                                timer: undoTimeout,
                                $sentenceSectionBox,
                            });
                        });
                    }

                    /* 
                        Set point on track to start
                        playing from clicked point on track
                    */
                    $waveformTrack.addEventListener('click', () => {
                        $cursor.style.left = $selectionPoint.style.left;

                        updateEditorState();
                    });

                    $annotationsTextBoxContainer.addEventListener('scroll', () => {
                        calcSentenceScrollEndPoints();

                        updateEditorState();
                    });

                    /* 
                        Define keyboard shortcuts
                    */
                    hotkeys('ctrl+z', (e, handler) => {
                        e.preventDefault();

                        if (undoQueue.length > 0) {
                            const { $sentence, $parent, timer, $sentenceSectionBox } = undoQueue.shift();
                            if (timer != null) {
                                clearTimeout(timer);

                                const { startTime, endTime, sentenceId } = getSentenceInfo($sentence);

                                let flag = true;

                                $sentence.classList.add('flash'); // add flash higlight on undo

                                for (let idx in $annotations) {
                                    let id = parseInt(idx);
                                    if (!isNaN(id)) {
                                        const info = getSentenceInfo($annotations[id]);

                                        if (info.startTime >= endTime) {
                                            // can be optimized using lower_bound()
                                            $parent.insertBefore($sentence, $parent.children[id]);
                                            flag = false;
                                            break;
                                        }
                                    }
                                }
                                if (flag) $parent.appendChild($sentence); // last element was deleted

                                $sentenceSectionBox.style.display = 'block';
                                $sentenceSectionBox.classList.add('flash');

                                setTimeout(() => {
                                    $sentence.classList.remove('flash');
                                    $sentenceSectionBox.classList.remove('flash');
                                }, 1500);

                                removeToast(sentenceId);
                                updateAnnotations();
                            }
                        }
                    });

                    hotkeys('down', (e, handler) => {
                        e.preventDefault();
                        sentenceFocus = true;

                        const { $prevSentenceNode } = getNextForHighlight(scrollPoints, 'down');

                        /* 
                            Call function to save edit here
                        */
                        save($prevSentenceNode).then(resp => {
                            console.log('saved!');
                            setTimeout(() => dispatch(toggleSaveMode(false)), 1000);
                        });

                        playMode = 'play';

                        updateEditorState();
                    });

                    hotkeys('up', (e, handler) => {
                        e.preventDefault();
                        sentenceFocus = true;

                        const { $prevSentenceNode } = getNextForHighlight(scrollPoints, 'up');

                        /* 
                            Call function to save edit here
                        */
                        save($prevSentenceNode).then(resp => {
                            console.log('saved!');
                            setTimeout(() => dispatch(toggleSaveMode(false)), 1000);
                        });

                        playMode = 'play';

                        updateEditorState();
                    });

                    hotkeys('enter', (e, handler) => {
                        e.preventDefault();
                        let $currentHighlighted = getCurrentHighlightedElement();

                        if (!$currentHighlighted) $currentHighlighted = $annotations[sentenceIdOnCursor];

                        console.log($currentHighlighted, sentenceIdOnCursor);

                        if ($currentHighlighted) {
                            ee.emit('stop');

                            playMode = 'play';
                            sentenceFocus = true;

                            let $currentAnnotationText = $currentHighlighted.getElementsByClassName(
                                'annotation-lines'
                            )[0];
                            let { sentenceId, startTime } = getSentenceInfo($currentHighlighted);

                            /* Reason for timeout: https://stackoverflow.com/questions/15859113/focus-not-working */
                            setTimeout(() => $currentAnnotationText.focus(), 0);

                            scrollToSection(sentenceId);
                            setCursor(startTime + 0.2);

                            setTimeout(() => addSentenceHighlight($currentHighlighted), 20);
                        }

                        updateEditorState();
                    });

                    hotkeys('ctrl+p', (e, handler) => {
                        e.preventDefault();

                        cue();

                        updateEditorState();
                    });

                    /* 
                        Block refresh commands of the browser 
                    */
                    hotkeys('command+r', (e, handler) => {
                        e.preventDefault();
                        console.log('refreshed');
                    });

                    hotkeys('ctrl+r', (e, handler) => {
                        e.preventDefault();
                        console.log('refreshed');
                    });
                });
        }, 100);
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
