var fs = require('fs');
// var layer = require('cloud/layer-parse-module/layer-module.js');

// var layerProviderID = 'layer:///providers/b1a6b610-ef56-11e4-8151-d4f42c00641d';
// var layerKeyID = 'layer:///keys/1e4445ca-2f86-11e5-b9f8-0dbd000061cf';
// var privateKey = fs.readFileSync('cloud/layer-parse-module/keys/layer-key.js');
// layer.initialize(layerProviderID, layerKeyID, privateKey);

Parse.Cloud.define("generateToken", function(request, response) {
 var userID = request.params.userID;
 var nonce = request.params.nonce;
 if (!userID) throw new Error('Missing userID parameter');
 if (!nonce) throw new Error('Missing nonce parameter');
 // response.success(layer.layerIdentityToken(userID, nonce));
});


/**********************************************
Comment saved.
1. Post notification to secret's owner and also
the users who had commented.
2. Activity will be showned on comment's owner
,secret owner
exclude the current comment owner.
************************************************/

Parse.Cloud.define("CommentSaved", function(request, response) {
  secretQuery = new Parse.Query("Secret");
  secretQuery.include("user");
  var ownerId;
  var activityArray=[];
  var secret;
  
  secretQuery.get(request.params.secretId, {
    success: function(result) {
      var user=result.get("user");
      ownerId=user.id; //get the owner of this secret
      secret = result;
      
      //do not saved if owner comment it.
      if(user.id != request.params.userId){
        var Activity = Parse.Object.extend("Activity");
        var activity = new Activity();
        activity.set("user", user);
        activity.set("secret",secret);
        activity.set("userId",user.id);
        activity.set("type", "comment");
        activity.set("secretId",request.params.secretId);
        activity.set("viewed",false);
        activityArray.push(activity);
      }
      query = new Parse.Query("Comment");
      query.equalTo("secretId", request.params.secretId);
      
      query.include("user");
      query.include("secret");

      var currentUserId = request.params.userId;
      var flags = [];
      var uniqueArry = [];

      query.find({
        success: function(results) {
          var  l = results.length, i;
          for( i=0; i<l; i++) {
            var usr=results[i].get("user");
            if( flags[usr.id]) continue;
            flags[usr.id] = true;
            uniqueArry.push(results[i]);
        }//end for
        for (var i = 0; i < uniqueArry.length; ++i) {
          //add activity to all users who comments except current user
          var user=uniqueArry[i].get("user");
          if(user.id != request.params.userId && user.id != ownerId){
            var Activity = Parse.Object.extend("Activity");
            var activity = new Activity();
            activity.set("secret",secret);
            activity.set("userId",user.id);
            activity.set("user", uniqueArry[i].get("user"));
            activity.set("type", "comment");
            activity.set("secretId",request.params.secretId);
            activity.set("viewed",false);
            activityArray.push(activity);
          }//end if
        }//end for

        //Start getting subscribers
        console.log("--START getting SUBSCRIBERS--");
        query = new Parse.Query("Subscribe");
        query.equalTo("secretId", request.params.secretId);
        query.include("user");
        query.include("secret");
        var currentUserId=request.params.userId;
        //reset unique array
        uniqueArry = [];
        query.find({
          success: function(results) {
            if (results.length > 0){
              var result = results[0];
              var subscribers=result.get("subscribers");
              var  l = subscribers.length, i;
              for( i=0; i<l; i++) {
                var usr=subscribers[i];
                if( flags[usr]) continue;
                flags[usr] = true;
                uniqueArry.push(subscribers[i]); //use the same array when searching comment
              }//end for
              console.log("--Start building activities for subscribers--" + activityArray.length);
              for (var i = 0; i < uniqueArry.length; ++i) {
                var user=uniqueArry[i];
                if(user != request.params.userId && user != ownerId){
                  var Activity = Parse.Object.extend("Activity");
                  var activity = new Activity();
                  activity.set("secret",secret);
                  activity.set("userId",user);
                  activity.set("type", "comment");
                  activity.set("secretId",request.params.secretId);
                  activity.set("viewed",false);
                  activityArray.push(activity);  
                }//end if
              }//end for
            }//end if
            else{
              console.log("No subscribers found.");
            }

            Parse.Object.saveAll(activityArray, {
              success: function(objs) {
                console.log("Save activities success");
                var pushQuery = new Parse.Query(Parse.Installation);
                //pushQuery.equalTo('deviceType', 'ios');
                pushQuery.equalTo('enable', true);
                pushQuery.notEqualTo("userId", request.params.userId);
                pushQuery.equalTo("userId",ownerId);

                Parse.Push.send({
                  where: pushQuery, // Set our Installation query
                  data: {
                    alert: '\ue04a \ue04a Someone else replied to your 呢D. \ue056 \ue056',
                    badge: 1
                  }
                }, 
                {
                  success: function() {
                // Push was successful
                response.success("success push to post owner for new comment.");
                },//end push success
                error: function(error) {
                  console.log("Got an error sending push notification " + error.code + ":" + error.message); 
                  response.error("failed 2");
                  }//end push error
                });//END PUSH NOTIFICATION
              },
              error: function(error) { 
                console.log("Got an error while saving activities " + error.code + ":" + error.message); 
                response.error("error while saving activities.");
              }
            });//END SAVE ALL
        },//END SUCCESS SUBSCRIBER QUERY
        error: function() {
          console.log("Got an error querying users who subscribed " + error.code + ":" + error.message); 
          response.error("Got an error querying users who subscribed ");
          }//end error
        }); //END SUBSCRIBER QUERY
      },//EBD SUCCESS COMMENT QUERY
      error: function() {
        console.log("Got an error querying users who comments " + error.code + ":" + error.message); 
        response.error("Got an error querying users who comments ");
      }//end error
    }); //end COMMENT QUERY

},
error: function(error) {
  console.error("Got an error when adding activity to secret's owner " + error.code + " : " + error.message);
    }//end query error
  });//END SECRET QUERY

});//END FUNCTION
/**********************************************
Comment Liked
1. Post notification to comment's owner.
2. Activity will be showned on comment's owner
************************************************/
Parse.Cloud.define("CommentLiked", function(request, response) {
  query = new Parse.Query("Comment");
  query.include("user");
  query.include("secret");
  var likedUserId=request.params.likeUserId;
  query.get(request.params.commentId, {
    success: function(result) {
      //add liked users.        
      result.increment("likes");
      result.addUnique("likesUsers",likedUserId);
      result.save();

      var user=result.get("user");

      if(likedUserId==user.id){
        console.log("Liked comment - liked user is comment owner");
        response.success("success"); //do not push if owner like it himself/herself.
      }
      else{
        var Activity = Parse.Object.extend("Activity");
        var activity = new Activity();
        activity.set("userId",user.id);
        var secret=result.get("secret");
        activity.set("secret",secret);
        activity.set("user", result.get("user"));
        activity.set("type", "CommentLiked");
        activity.set("secretId",secret.id);
        activity.set("viewed",false);
        activity.save();
      }


      //set push notification for owner
       /***********************
      Push Notification
      ************************/
      var pushQuery = new Parse.Query(Parse.Installation);
      //pushQuery.equalTo('deviceType', 'ios');
      pushQuery.equalTo("userId",user.id);
      pushQuery.equalTo('enable', true);

      console.log("Start Push Notification");
      Parse.Push.send({
        where: pushQuery, // Set our Installation query
        data: {
          alert: 'Someone else loved your 呢D. \ue056 \ue056',
          badge: 1

        }
      }, 
      {
        success: function() {
        // Push was successful
        response.success("success");
        },//end push success
        error: function(error) {
          console.log("Got an error " + error.code + ":" + error.message); 
          response.error("failed 2");
        }//end push error
      });//end push notification

    },
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    }
  });
});
/**********************************************
Comment Dislike
1. Post notification to comment's owner.
2. Activity will be showned on comment's owner
************************************************/

Parse.Cloud.define("CommentDisliked", function(request, response) {
  query = new Parse.Query("Comment");
  query.include("user");
  console.log(request.params.commentId);
  query.get(request.params.commentId, {
    success: function(result) {
      var user=result.get("user");
      result.increment("likes",-1);
      result.remove("likesUsers",user.get("username"));
      result.save();
      response.success("Success");
    },
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    }//end query error
  });//end query
});
/**********************************************
Follow a post
1. Post notification to post owner.
2. Activity added to post owner.
************************************************/
Parse.Cloud.define("FollowPost", function(request, response) {
  query = new Parse.Query("Secret");
  query.include("user");

  query.get(request.params.secretId, {
    success: function(result) {
      //add liked users.        
      result.increment("follow");
      result.save();

      var user=result.get("user");
      //add to activity
      var Activity = Parse.Object.extend("Activity");
      var activity = new Activity();
      activity.set("userId",user.id);
      activity.set("secret",result);
      activity.set("user", result.get("user"));
      activity.set("type", "follow");
      activity.set("secretId",result.id);
      activity.set("viewed",false);
      activity.save();


      //set push notification for owner
       /***********************
      Push Notification
      ************************/
      var pushQuery = new Parse.Query(Parse.Installation);
      //pushQuery.equalTo('deviceType', 'ios');
      pushQuery.equalTo("userId",user.id);
      pushQuery.equalTo('enable', true);

      console.log("Start Push Notification");
      Parse.Push.send({
        where: pushQuery, // Set our Installation query
        data: {
          alert: 'Someone followed your 呢D. \ue056 \ue056',
          badge: 1

        }
      }, 
      {
        success: function() {
        // Push was successful
        response.success("success");
        },//end push success
        error: function(error) {
          console.log("Got an error " + error.code + ":" + error.message); 
          response.error("failed 2");
        }//end push error
      });//end push notification

    },
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    }
  });
});
/**************************************
Unfollow
**************************************/
Parse.Cloud.define("UnfollowPost", function(request, response) {
  query = new Parse.Query("Secret");
  query.get(request.params.secretId, {
    success: function(result) {
      var user=result.get("user");
      result.increment("follow",-1);
      result.save();
      response.success("Success");
    },
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    }//end query error
  });//end query
});


/**************************************
Unlike A Secret
**************************************/

Parse.Cloud.define("SecretDisliked", function(request, response) {
  query = new Parse.Query("Secret");
  query.get(request.params.secretId, {
    success: function(result) {
      result.increment("likes",-1);
      result.save();

      opQuery = new Parse.Query("Operation");
      opQuery.equalTo("secretId", request.params.secretId);
      opQuery.equalTo("userId", request.params.userId);
      opQuery.limit(1);
      console.log("Start deleting");
      opQuery.find({
        success: function(results) {
          for (var i = 0; i < results.length; i++) { 
            var object = results[i];
            console.log("Found an object to delete");
            object.destroy({
              success: function(object) {
                response.success("Success");
              },
              error: function(object, error) {
                console.log("Got an error while deleting an operation " + error.code + ":" + error.message); 
                response.error("Failed to unlike a secret");  
                }//end destroy error
              });//end destroy
          }//end for
        },
        error: function(error) {
          console.log("Got an error " + error.code + ":" + error.message); 
          response.error("Failed to unlike a secret");  
          }//end opquery
      });//end find
    },
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    }//end query error
  });//end query
});
/**************************************
Hates A Post 7/12
**************************************/
Parse.Cloud.define("PostHates", function(request, response) {
  query = new Parse.Query("Secret");
  var uid=request.params.userId; 
  query.get({ useMasterKey: true },request.params.secretId, {
    success: function(result) {
      result.increment("hates");
      result.save();
      var user=result.get("user");
      if(user.id != uid){

        var Activity = Parse.Object.extend("Activity");
        var activity = new Activity();
        activity.set("userId",user.id);
        activity.set("secret",result);
        activity.set("secretId",request.params.secretId);
        //set owner
        activity.set("user", result.get("user"));
        activity.set("type", "PostHates");
        activity.set("viewed",false);
        activity.save();
      }

      //***************************************************
      //PUSH TO OWNER
      //***************************************************
      var pushQuery = new Parse.Query(Parse.Installation);
      pushQuery.equalTo('enable', true);
      pushQuery.equalTo("userId",user.id);
      console.log("Start Push Notification for user " + user.id);
      Parse.Push.send({
        where: pushQuery, // Set our Installation query
        data: {
          alert: 'Someone \ue416 your 呢D. \ue411 \ue411',
          badge: 1

        }
      }, 
      {
        success: function() {
        // Push was successful
        response.success("success");
        },//end push success
        error: function(error) {
          console.log("Got an error " + error.code + ":" + error.message); 
          response.error("Got an error hating a post");
        }//end push error
      });//end push notification


    },
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    }
  });//end query
});

/*****************************************************************
Unhate a post
******************************************************************/
Parse.Cloud.define("PostUnhates", function(request, response) {
  query = new Parse.Query("Secret");
  query.get(request.params.secretId, {
    success: function(result) {
      result.increment("hates",-1);
      result.save();
      response.success("success");
    },//End Success
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
      response.error("Got an error unhating a post");
    }//end query error
  });//end query
});
/**************************************
Liked A Secret
**************************************/
Parse.Cloud.define("SecretLiked", function(request, response) {
  query = new Parse.Query("Secret");
  var uid=request.params.userId; 

  query.get(request.params.secretId, {
    success: function(result) {
      result.increment("likes");
      result.save();
      var user=result.get("user");
      if(user.id != uid){

        var Activity = Parse.Object.extend("Activity");
        var activity = new Activity();
        activity.set("userId",user.id);
        activity.set("secret",result);
        activity.set("secretId",request.params.secretId);
        //set owner
        activity.set("user", result.get("user"));
        activity.set("type", "SecretLiked");
        activity.set("viewed",false);
        activity.save();
      }
      //OBSOLETE in Iphone 5.0
      var Operation = Parse.Object.extend("Operation");
      var op = new Operation();
      op.set("userId",uid);
      op.set("secretId",request.params.secretId);
      op.set("type","SecretLiked");
      op.save();

      if(uid==user.id){
        console.log("Liked from the same user");
        response.success("Success");
      }
      //***************************************************
      //PUSH TO OWNER
      //***************************************************
      var pushQuery = new Parse.Query(Parse.Installation);
      pushQuery.equalTo('enable', true);
      pushQuery.equalTo("userId",user.id);
      console.log("Start Push Notification for user " + user.id);
      Parse.Push.send({
        where: pushQuery, // Set our Installation query
        data: {
          alert: 'Someone \ue022 your 呢D. \ue056 \ue056',
          badge: 1

        }
      }, 
      {
        success: function() {
        // Push was successful
        response.success("success");
        },//end push success
        error: function(error) {
          console.log("Got an error " + error.code + ":" + error.message); 
          response.error("failed while like a post");
        }//end push error
      });//end push notification


    },
    error: function(error) {
      console.error("Got an error " + error.code + " : " + error.message);
    }
  });//end query
});

/**************************************
View Activity - set to false if viewed
**************************************/

Parse.Cloud.define("ViewedActivity", function(request, response) {
  query = new Parse.Query("Activity");
  query.equalTo("secretId", request.params.secretId);
  query.equalTo("userId", request.params.userId);
  query.equalTo("viewed",false);
  query.find({
    success: function(results) {
      console.log(results);

      for (var i = 0; i < results.length; ++i) {
        var result=results[i];
        result.set("viewed",true);
      }//end for
      Parse.Object.saveAll(results,{
        success: function(list) {
          // All the objects were saved.
          response.success("ok " );  //saveAll is now finished and we can properly exit with confidence :-)
    },
    error: function(error) {
          // An error occurred while saving one of the objects.
          response.error("failure on saving list ");
        }
      });
    }, //end success 1
    error: function(error) {
      console.error("Error finding related user for activity " + error.code + ": " + error.message);
      response.error("failure viewing activity. ");

    }
  });
});
/**************************************
Get Trending - return the Trending tag
**************************************/
Parse.Cloud.define("GetTrendingList", function(request, response) {

  query = new Parse.Query("Trending");
  query.limit(10);
  query.descending("createdAt");
  query.find({
    success: function(results) {
      console.log(results);
      var result=[];
      for (var i = 0; i < results.length; ++i) {
       result.push(results[i].get("tag"));

      }//end for
      response.success(result);
    }, //end success 1
    error: function(error) {
      console.error("Error finding related user for activity " + error.code + ": " + error.message);
      response.error("failure geting trends. ");

    }
  });
});
/********************************************
ClearActivities - Clear all activities
********************************************/


Parse.Cloud.define("ClearActivities", function(request, response) {
  query = new Parse.Query("Activity");
  query.equalTo("userId", request.params.userId);
  query.equalTo("viewed",false);
  console.log(request.params.userId);
  query.find({
    success: function(results) {
      console.log(results);

      for (var i = 0; i < results.length; ++i) {
        var result=results[i];
        result.set("viewed",true);
      }//end for
      Parse.Object.saveAll(results,{
        success: function(list) {
          // All the objects were saved.
          response.success("ok " );  //saveAll is now finished and we can properly exit with confidence :-)
    },
    error: function(error) {
          // An error occurred while saving one of the objects.
          response.error("failure on saving list ");
        }
      });
    }, //end success 1
    error: function(error) {
      console.error("Error finding related user for activity " + error.code + ": " + error.message);
    }
  });
});

Parse.Cloud.job("removeTrend", function(request, status) {
  var query = new Parse.Query("Trending");

  query.find().then(function(trends) {
    return Parse.Object.destroyAll(trends);
  }).then(function(success) {
    status.success("Trends deletion complete");
  }, function(error) {
    status.error("Uh oh, something went wrong." + error.code + ": " + error.message);
  });
});

Parse.Cloud.job("jobGetTrend", function(request, status) {

  var query = new Parse.Query("Tags");
  var trends=[];
  query.find({
    success: function(results) {
      var currentTag;
      for (var i = 0; i < results.length; ++i) {
        var sum = 0;
        currentTag = results[i].get("tag");
        var exists=false;
        for (var k = 0; k < trends.length; ++k) {
          if (trends[k].get("tag") == currentTag) {
            exists=true;
            console.log("Exits");
          }
          }//end k
          if(!exists){
            for(var j=0;j<results.length;++j){
              if(results[j].get("tag")==currentTag){
                sum+=1;
              }//end if
            }//end j
            var Trend= Parse.Object.extend("Trending");
            var trend = new Trend();
            trend.set("tag",currentTag);
            trend.set("count",sum);
            trends.push(trend);  
         }//end if exists

      }//end i
      Parse.Object.saveAll(trends,{
        success: function(list) {
          // All the objects were saved.
          status.success("Trend generation complete");
        },
        error: function(error) {
          status.error("Uh oh, something went wrong." + error.code + ": " + error.message);
        }      
      });

    },
    error: function() {
      response.error("movie lookup failed");
    }
  });
});

/**********************************************
Before saving a secret, check for banned user
**********************************************/
Parse.Cloud.beforeSave("Secret", function(request, response) {
  var secret = request.object;
  var user=request.object.get("user");
  var userId=user.id;
  var image = request.object.get("image");

  var arry = ["SP", "SL", "曳","WECHAT", "on9","s.p","撚","想要","SKYPE","鹹野","卜野","傾sex","含","濕","3P","舔","P.S.","甜野","咸計","CHAT SEX","NAUGHTY TALK","S.E.X.","S.E.X","曳野","鮑養","18+","一星期戀人","戀 人","大波","TELEGRAM", "S_P","FUCK","$","咸野","S CHAT","邪骨","女奴","SNAPCHAT","叫雞","人妻","微信","PS","WE CHAT","SEXCHAT","GROUP","㸒","色情","SM","iwantfirsttime","淫","炮友","床","性慾","人夫", "SEX CHAT","屌","含","咸濕","扑嘢","口爆","援交","PHONE SEX","WTS","LINE","WHATSAPP","好濕","打飛機","做愛"];
  var text = request.object.get("secret");
  text = text.toUpperCase();
  for (var j=0; j<arry.length; j++) {
    if(text.indexOf(arry[j]) > -1){
      response.error("Invalid ");
    }
  }

  //disable image
  var substring = "files";  
  if(image.indexOf(substring) > -1){
   //response.error("Invalid ");
 }
  /*
  var substring2 = "SL";
  if(text.indexOf(substring2) > -1){
    response.error("Invalid ");
  }*/  

  banQuery = new Parse.Query("ban");
  banQuery.equalTo("userId", userId);


  banQuery.count({
    success: function(count) {
      if (count>0){
        console.log("user is banned" + userId)
        response.error("USER BANNED");
      }else{
        response.success();
      }
    },
    error: function(error) {
      response.error("failure on before saving.. " + error);
    }
  }); 

});

/**********************************************
Before saving a comment, check for banned user
**********************************************/
Parse.Cloud.beforeSave("Comment", function(request, response) {
  var secret = request.object;
  var user=request.object.get("user");
  var userId=user.id;

  banQuery = new Parse.Query("ban");
  banQuery.equalTo("userId", userId);


  banQuery.count({
    success: function(count) {
      if (count>0){
        console.log("user is banned" + userId)
        response.error("USER BANNED");
      }else{
        response.success();
      }
    },
    error: function(error) {
      response.error("failure on before saving.. " + error);
    }
  }); 
  
});


/**********************************************
Before saving an operation, check for duplicate
**********************************************/
var Operation = Parse.Object.extend("Operation");

// Check if stopId is set, and enforce uniqueness based on the stopId column.
Parse.Cloud.beforeSave("Operation", function(request, response) {
  if (!request.object.get("commentId")) {
    var query = new Parse.Query("Operation");
    query.equalTo("secretId", request.object.get("secretId"));
    query.equalTo("userId", request.object.get("userId"));
    query.count({
      success: function(count) {
        console.log("count" + count);
        if(count>0){
          response.error("Operation record is not unique");
        }
        else{
          response.success();
        }
      },
      error: function(error) {
        status.error("Uh oh, something went wrong on saving operation." + error.code + ": " + error.message);
      }//end error
    });//end count
  }//end if
});
//*********************************************
//Flag Post
//*********************************************
var Operation = Parse.Object.extend("Flag");

// Check if stopId is set, and enforce uniqueness based on the stopId column.
Parse.Cloud.beforeSave("Flag", function(request, response) {
  if (request.object.get("secretId")) {
    console.log("Flag a secret");
    console.log(request.object.get("secretId"));
    var query = new Parse.Query("Flag");
    query.equalTo("secretId", request.object.get("secretId"));

    query.count({
      success: function(count) {
        console.log("count" + count);
        if(count>2){
          //Send to Admin for review
          var pushQuery = new Parse.Query(Parse.Installation);
          pushQuery.equalTo('enable', true);
          pushQuery.equalTo("channels","ADMIN");
          Parse.Push.send({
            where: pushQuery, // Set our Installation query
            data: {
              alert: 'FLAG ALERT ' + request.object.get("secretText") ,
              badge: 1
            }
          }, 
          {
            success: function() {
            // Push was successful
            response.success("success");
          },//end push success
          error: function(error) {
            console.log("Got an error " + error.code + ":" + error.message); 
            response.error("failed to send to admin");
          }//end push error
        });//end push notification
          response.success();
        }
        else{
          response.success();
        }
      },
      error: function(error) {
        status.error("Uh oh, something went wrong on saving operation." + error.code + ": " + error.message);
      }//end error
    });//end count
  }//end if
});


/*
Parse.Cloud.afterSave(Parse.User, function(request) {
  Parse.Cloud.useMasterKey();  
  var Ranking = Parse.Object.extend("UserRanking");
  var ranking = new Ranking();
  ranking.set("userId", request.object.id);
  ranking.set("no_likes",0);
  ranking.set("no_hates",0);
  ranking.set("no_comments", 0);
  ranking.save();
});*/


Parse.Cloud.afterSave("Secret", function(request, response) {

  var user = request.object.get("user");
  var uId = user.id;
  var query = new Parse.Query("UserRanking");
  query.equalTo("userId", uId);
  console.log("Comment After Save");
  query.find({
    success: function(results) {
      if (results.length <= 0){
        console.log("Create User Ranking");
        var Ranking = Parse.Object.extend("UserRanking");
        var ranking = new Ranking();
        ranking.set("userId", uId);
        ranking.set("no_likes",0);
        ranking.set("no_hates",0);
        ranking.set("no_follows",0);
        ranking.set("no_comments", 0);
        ranking.set("scores",0);
        ranking.set("rank_score",0);
        ranking.set("rank","我覺得自己係零");
        ranking.save();
      } 
    },
    error: function() {
      response.error("Query User Ranking Failed.");
    }
  });//end query
});


Parse.Cloud.afterSave("Activity", function(request, response) {
  if (request.object.get("secret")) {
    var secret = request.object.get("secret");
    secretQuery = new Parse.Query("Secret");
    secretQuery.include("user");
    
    secretQuery.get(secret.id, {
      success: function(result) {
        var user = result.get("user");
        var uId = user.id;
        var query = new Parse.Query("UserRanking");
        query.equalTo("userId", uId);
        console.log("Activity After Save");
        query.find({
          success: function(results) {
            if (results.length > 0){
              var r = results[0];
              var scores = r.get("scores");
              if (scores < 10){
                r.set("rank","我覺得自己係零");
                r.set("rank_score",0);
              }
              else if (scores > 10){
                r.set("rank","下一站天后");
                r.set("rank_score",1);
              }else if (scores > 20){

                r.set("rank","朋友二號");
                r.set("rank_score",2);
              }else if (scores > 30){
                r.set("rank","三角誌");
                r.set("rank_score",3)
              }
              else if (scores > 50){
                r.set("rank","四人遊");
                r.set("rank_score",4);
              }
              else if (scores > 80){
                r.set("rank","十月初五的月光(祝君好)");
                r.set("rank_score",5);
              }
              else if (scores > 130){
                r.set("rank","六天");
                r.set("rank_score",6);
              }else if (scores > 210){
                r.set("rank","七友");
                r.set("rank_score",7);
              }
              else if (scores > 340){
                r.set("rank","1874");
                r.set("rank_score",8);
              }
              else if (scores > 550){
                r.set("rank","九因歌");
                r.set("rank_score",9);
              }
              else if (scores > 890){
                r.set("rank","十分愛");
                r.set("rank_score",10);
              }
              else if (scores > 1440){
                r.set("rank","閃電十一人");
                r.set("rank_score",11);
              }
              else if (scores > 2330){
                r.set("rank","十二隻恐龍去野餐");
                r.set("rank_score",12);
              }
              else if (scores > 3770){
                r.set("rank","13點");
                r.set("rank_score",13);
              }
              else if (scores > 6100){
                r.set("rank","十四座");
                r.set("rank_score",14);
              }
              else if (scores > 9870){
                r.set("rank","fifteen");
                r.set("rank_score",15);
              }
              else if (scores > 15970){
                r.set("rank","十六號愛人");
                r.set("rank_score",16);
              }
              else if (scores > 25870){
                r.set("rank","十七度");
                r.set("rank_score",17);
              }
              else if (scores > 41810){
                r.set("rank","十八相送");
                r.set("rank_score",18);
              }
              else if (scores > 67650){
                r.set("rank","上海 一九四三");
                r.set("rank_score",19);
              }
              else if (scores > 109460){
                r.set("rank","二十世紀少年");
                r.set("rank_score",20);
              }

              var type = request.object.get("type");
              if (type == "comment"){
                  //ignore comments

                }
                else if (type == "CommentLiked"){
                  r.increment("scores");
                  r.increment("no_comments");
                  r.save();
                }
                else if (type == "SecretLiked"){
                  r.increment("scores");
                  r.increment("no_likes");
                  r.save();
                }
                else if (type == "follow"){
                  r.increment("scores");
                  r.increment("no_follows");
                  r.save();
                }
                else if (type == "PostHates"){
                  r.increment("scores",-1);
                  r.increment("no_hates");
                  r.save();
                }
                console.log("update user rank success");
              }else{
                console.log("create new user ranking.");
                var Ranking = Parse.Object.extend("UserRanking");
                var ranking = new Ranking();
                ranking.set("userId", uId);
                ranking.set("no_likes",0);
                ranking.set("no_hates",0);
                ranking.set("no_follows",0);
                ranking.set("no_comments", 0);
                ranking.set("scores",0);
                ranking.set("rank_score",0);
                ranking.set("rank","我覺得自己係零");
                ranking.save();
              }
            },
            error: function() {
              response.error("Comment after save failed");
            }
  });//end query
},
error: function() {
  response.error("Comment after save failed");
}
});
  }//end if
});

Parse.Cloud.afterSave("Comment", function(request, response) {
  if (request.object.get("owner")) {
    var user = request.object.get("owner");
    var uId = user.id;
    var query = new Parse.Query("UserRanking");
    query.equalTo("userId", uId);
    console.log("Comment After Save");
    query.find({
      success: function(results) {
        if (results.length > 0){
          var r = results[0];
          var scores = r.get("scores");
          if (scores < 10){
            r.set("rank","我覺得自己係零");
            r.set("rank_score",0)
          }
          else if (scores > 10){
            r.set("rank","下一站天后");
            r.set("rank_score",1);
          }else if (scores > 20){

            r.set("rank","朋友二號");
            r.set("rank_score",2);
          }else if (scores > 30){
            r.set("rank","三角誌");
            r.set("rank_score",3);
          }
          else if (scores > 50){
            r.set("rank","四人遊");
            r.set("rank_score",4);
          }
          else if (scores > 80){
            r.set("rank","十月初五的月光(祝君好)");
            r.set("rank_score",5);
          }
          else if (scores > 130){
            r.set("rank","六天");
            r.set("rank_score",6);
          }else if (scores > 210){
            r.set("rank","七友");
            r.set("rank_score",7);
          }
          else if (scores > 340){
            r.set("rank","1874");
            r.set("rank_score",8);
          }
          else if (scores > 550){
            r.set("rank","九因歌");
            r.set("rank_score",9);
          }
          else if (scores > 890){
            r.set("rank","十分愛");
            r.set("rank_score",10);
          }
          else if (scores > 1440){
            r.set("rank","閃電十一人");
            r.set("rank_score",11);
          }
          else if (scores > 2330){
            r.set("rank","十二隻恐龍去野餐");
            r.set("rank_score",12);
          }
          else if (scores > 3770){
            r.set("rank","13點");
            r.set("rank_score",13);
          }
          else if (scores > 6100){
            r.set("rank","十四座");
            r.set("rank_score",14);
          }
          else if (scores > 9870){
            r.set("rank","fifteen");
            r.set("rank_score",15);
          }
          else if (scores > 15970){
            r.set("rank","十六號愛人");
            r.set("rank_score",16);
          }
          else if (scores > 25870){
            r.set("rank","十七度");
            r.set("rank_score",17);
          }
          else if (scores > 41810){
            r.set("rank","十八相送");
            r.set("rank_score",18);
          }
          else if (scores > 67650){
            r.set("rank","上海 一九四三");
            r.set("rank_score",19);
          }
          else if (scores > 109460){
            r.set("rank","二十世紀少年");
            r.set("rank_score",20);
          }
          
          r.increment("scores");
          r.increment("no_comments");
          r.save();
          console.log("update user rank success");
        }else{
          console.log("create new user ranking.");
          var Ranking = Parse.Object.extend("UserRanking");
          var ranking = new Ranking();
          ranking.set("userId", uId);
          ranking.set("no_likes",0);
          ranking.set("no_hates",0);
          ranking.set("no_follows",0);
          ranking.set("no_comments", 0);
          ranking.set("scores",0);
          ranking.set("rank_score",0);
          ranking.set("rank","我覺得自己係零");
          ranking.save();
        }
      },
      error: function() {
        response.error("Comment after save failed");
      }
    });
}
});

Parse.Cloud.afterSave("Warning", function(request, response) {
  if (request.object.get("userId")) {
    var userId = request.object.get("userId");
    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.equalTo('enable', true);
    pushQuery.equalTo("userId",userId);

    Parse.Push.send({
                  where: pushQuery, // Set our Installation query
                  data: {
                    alert: '請不要張貼色情內容,第二個警告,帳戶將被禁止',
                    badge: 1
                  }
                }, 
                {
                  success: function() {
                // Push was successful
                response.success("success push notification to warning user");
                },//end push success
                error: function(error) {
                  console.log("Got an error sending push notification to warning user " + error.code + ":" + error.message); 
                  response.error("failed 2");
                  }//end push error
                });//END PUSH NOTIFICATION
  }
});

/************************************************
Update default value 
************************************************/
Parse.Cloud.job("jobUpdateDefault", function(request, status) {

  var query = new Parse.Query("Secret");
  query.limit(10000);
  query.skip(6000)
  var trends=[];
  query.find({
    success: function(results) {
      var currentTag;
      for (var i = 0; i < results.length; ++i) {
        results[i].set("allowFollow",false);
        results[i].set("hasAudio",false);


      }//end i
      console.log("i" + i);
      Parse.Object.saveAll(results,{
        success: function(list) {
          // All the objects were saved.
          status.success("jobUpdateDefault ran successfuly");
        },
        error: function(error) {
          status.error("Uh oh, something went wrong." + error.code + ": " + error.message);
        }      
      });

    },
    error: function() {
      response.error("movie lookup failed");
    }
  });
});