import React, { Component, Fragment } from "react";

import Post from "../../components/Feed/Post/Post";
import Button from "../../components/Button/Button";
import FeedEdit from "../../components/Feed/FeedEdit/FeedEdit";
import Input from "../../components/Form/Input/Input";
import Paginator from "../../components/Paginator/Paginator";
import Loader from "../../components/Loader/Loader";
import ErrorHandler from "../../components/ErrorHandler/ErrorHandler";
import "./Feed.css";

class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: "",
    postPage: 1,
    postsLoading: true,
    editLoading: false,
  };

  componentDidMount() {
    const graphqlQuery = {
      query: `{
        getStatus {
          status
        }
      }`,
    };
    fetch("http://localhost:8080/graphql", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.props.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then((res) => {
        return res.json();
      })
      .then((resData) => {
        console.log(resData);
        if (resData.errors) {
          throw new Error("Failed to fetch user status.", resData.errors);
        }
        this.setState({ status: resData.data.getStatus.status });
      })
      .catch(this.catchError);
    this.loadPosts();
  }

  loadPosts = (direction) => {
    if (direction) {
      this.setState({ postsLoading: true, posts: [] });
    }
    let page = this.state.postPage;
    if (direction === "next") {
      page++;
      this.setState({ postPage: page });
    }
    if (direction === "previous") {
      page--;
      this.setState({ postPage: page });
    }
    const graphqlQuery = {
      query: `query FetchPosts($page: Int) {
        getPosts(page: $page) {
          posts {
            _id
            title
            content
            imageUrl
            creator {
              _id
              name
            }
            createdAt
          }
          totalItems
        }
      }
    `,
      variables: {
        page: page,
      },
    };
    fetch("http://localhost:8080/graphql", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.props.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then((res) => {
        return res.json();
      })
      .then((resData) => {
        console.log(resData);
        if (resData.errors) {
          throw new Error("fetch posts failed!");
        }
        this.setState({
          posts: resData.data.getPosts.posts.map((post) => {
            return {
              ...post,
              imagePath: post.imageUrl,
            };
          }),
          totalPosts: resData.data.getPosts.totalItems,
          postsLoading: false,
        });
      })
      .catch(this.catchError);
  };

  statusUpdateHandler = (event) => {
    event.preventDefault();
    const graphqlQuery = {
      query: `
        mutation UpdateStatus($status: String!){
          updateStatus(status: $status) {
            status
          }
        }
      `,
      variables: {
        status: this.state.status,
      },
    };
    fetch("http://localhost:8080/graphql", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.props.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then((res) => {
        return res.json();
      })
      .then((resData) => {
        console.log(resData);
        if (resData.errors) {
          throw new Error("failed to update status!");
        }
        this.setState({ status: resData.data.updateStatus.status });
      })
      .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
  };

  startEditPostHandler = (postId) => {
    this.setState((prevState) => {
      const loadedPost = { ...prevState.posts.find((p) => p._id === postId) };
      return {
        isEditing: true,
        editPost: loadedPost,
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({ isEditing: false, editPost: null });
  };

  finishEditHandler = (postData) => {
    this.setState({
      editLoading: true,
    });

    const formData = new FormData();
    formData.append("image", postData.image);
    if (this.state.editPost) {
      formData.append("oldPath", this.state.editPost.imagePath);
    }

    fetch("http://localhost:8080/post-image", {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + this.props.token,
      },
      body: formData,
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        let conditionalVars = {};
        let newOrUpdate;
        if (this.state.editPost) {
          newOrUpdate = `UpdatePost($id: ID!, $title: String!, $imageUrl: String!, $content: String!) {
          updatePost(id: $id `;
          conditionalVars = {
            id: this.state.editPost._id,
            title: postData.title,
            imageUrl: data.filePath || "undefined",
            content: postData.content,
          };
        } else {
          newOrUpdate = `CreatePost($title: String!, $imageUrl: String!, $content: String!) {
          createPost(`;
          conditionalVars = {
            title: postData.title,
            imageUrl: data.filePath || "undefined",
            content: postData.content,
          };
        }
        const graphqlQuery = {
          query: `
              mutation ${newOrUpdate}postInput: {
                  title: $title, 
                  imageUrl: $imageUrl,
                  content: $content
                }) {
                  _id
                  title
                  content
                  imageUrl
                  creator {
                    _id
                    name
                  }
                  createdAt
                  updatedAt
                }
              }
              `,
          variables: conditionalVars,
        };
        //graphql slashes need to be escaped twice, all this to just get ONE slash into the path.
        const adjustedQuery = JSON.stringify(graphqlQuery);
        return fetch("http://localhost:8080/graphql", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + this.props.token,
            "Content-Type": "application/json",
          },
          body: adjustedQuery,
        });
      })
      .then((res) => {
        return res.json();
      })
      .then((resData) => {
        console.log(resData);
        if (resData.errors) {
          throw new Error("creating a post failed!");
        }
        let resDataType;
        if (this.state.editPost) {
          resDataType = "updatePost";
        } else {
          resDataType = "createPost";
        }
        const post = {
          _id: resData.data[resDataType]._id,
          title: resData.data[resDataType].title,
          content: resData.data[resDataType].content,
          creator: {
            _id: resData.data[resDataType].creator._id,
            name: resData.data[resDataType].creator.name,
          },
          createdAt: resData.data[resDataType].createdAt,
          imagePath: resData.data[resDataType].imageUrl,
        };
        this.setState((prevState) => {
          let updatedPosts = [...prevState.posts];
          let updatedtotalPosts = prevState.totalPosts;
          if (prevState.editPost) {
            const postIndex = prevState.posts.findIndex(
              (p) => p._id === prevState.editPost._id
            );
            updatedPosts[postIndex] = post;
          } else {
            updatedtotalPosts++;
            if (prevState.posts.length >= 2) {
              updatedPosts.pop();
            }
            updatedPosts.unshift(post);
          }
          return {
            posts: updatedPosts,
            isEditing: false,
            editPost: null,
            editLoading: false,
            totalPosts: updatedtotalPosts,
          };
        });
      })
      .catch((err) => {
        console.log(err);
        this.setState({
          isEditing: false,
          editPost: null,
          editLoading: false,
          error: err,
        });
      });
  };

  statusInputChangeHandler = (input, value) => {
    this.setState({ status: value });
  };

  deletePostHandler = (postId) => {
    this.setState({ postsLoading: true });
    const graphqlQuery = {
      query: `
        mutation DeletePost($id: ID!) {
          deletePost(id: $id)
        }
      `,
      variables: {
        id: postId,
      },
    };
    fetch("http://localhost:8080/graphql", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.props.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then((res) => {
        return res.json();
      })
      .then((resData) => {
        if (resData.errors) {
          throw new Error("Deleting a post failed!");
        }
        this.loadPosts();
      })
      .catch((err) => {
        console.log(err);
        this.setState({ postsLoading: false });
      });
  };

  errorHandler = () => {
    this.setState({ error: null });
  };

  catchError = (error) => {
    this.setState({ error: error });
  };

  render() {
    return (
      <Fragment>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className='feed__status'>
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              type='text'
              placeholder='Your status'
              control='input'
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode='flat' type='submit'>
              Update
            </Button>
          </form>
        </section>
        <section className='feed__control'>
          <Button mode='raised' design='accent' onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className='feed'>
          {this.state.postsLoading && (
            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{ textAlign: "center" }}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, "previous")}
              onNext={this.loadPosts.bind(this, "next")}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map((post) => (
                <Post
                  key={post._id}
                  id={post._id}
                  authorId={post.creator._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString("en-US")}
                  title={post.title}
                  image={post.imageUrl}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
              ))}
            </Paginator>
          )}
        </section>
      </Fragment>
    );
  }
}

export default Feed;
